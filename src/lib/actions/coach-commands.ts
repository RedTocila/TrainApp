"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import { logCustomMeal } from "@/lib/actions/daily-meals";
import { upsertBodyWeightLog } from "@/lib/actions/weight-logs";
import { addWater } from "@/lib/actions/logs";
import {
  getHabitsWithCompletions,
  toggleHabitCompletion,
} from "@/lib/actions/habits";
import {
  assignPersonalWorkoutPlan,
  clearUpcomingWorkoutSchedule,
  deletePersonalWorkoutPlan,
  getPersonalWorkoutPlans,
  getUpcomingWorkoutScheduleSummary,
  scheduleWorkoutSeries,
} from "@/lib/actions/user-workouts";
import {
  assignPersonalNutritionPlan,
  deletePersonalNutritionPlan,
  getPersonalNutritionPlans,
} from "@/lib/actions/user-nutrition";
import {
  clearNutritionSchedule,
  scheduleNutritionSeries,
} from "@/lib/actions/user-nutrition-schedule";
import { updateClientIntakeFromResponses } from "@/lib/actions/client-intake";
import {
  normalizeIntakeResponses,
  profileToResponses,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import type { MealType } from "@/lib/types";
import type { Profile } from "@/lib/types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
}

function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  return { supabase, userId: user.id };
}

function isOneOffCalendarPlan(description: string | null | undefined): boolean {
  return (description ?? "").toLowerCase().includes("one-off session");
}

export async function listCoachWorkoutPlans(userId: string) {
  const plans = await getPersonalWorkoutPlans();
  // getPersonalWorkoutPlans uses session user — ignore passed id mismatch
  void userId;
  const library = plans.filter((p) => !isOneOffCalendarPlan(p.description));
  const oneOffCount = plans.length - library.length;
  return {
    plans: library.map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind ?? "strength",
      description: p.description ?? null,
    })),
    oneOffCount,
  };
}

export async function summarizeCoachUpcomingWorkoutSchedule() {
  return getUpcomingWorkoutScheduleSummary();
}

export async function listCoachNutritionPlans() {
  const plans = await getPersonalNutritionPlans();
  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? null,
  }));
}

export async function resolveWorkoutPlanLabel(
  planId: string
): Promise<{ id: string; title: string; dayCount: number } | null> {
  const auth = await requireUser();
  if ("error" in auth) return null;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, title")
    .eq("id", planId)
    .eq("created_by", auth.userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (!plan) return null;
  const { data: days } = await admin
    .from("workout_days")
    .select("id")
    .eq("plan_id", planId);
  return {
    id: plan.id as string,
    title: (plan.title as string) || "Workout",
    dayCount: days?.length ?? 0,
  };
}

export async function resolveNutritionPlanLabel(
  planId: string
): Promise<{ id: string; title: string } | null> {
  const auth = await requireUser();
  if ("error" in auth) return null;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("nutrition_plans")
    .select("id, title")
    .eq("id", planId)
    .eq("created_by", auth.userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (!plan) return null;
  return { id: plan.id as string, title: (plan.title as string) || "Nutrition plan" };
}

/** Soft: log a meal for today (or given date). */
export async function coachLogMealCommand(input: {
  name: string;
  meal_type?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  description?: string;
  date?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const name = input.name.trim();
  if (!name) return { error: "Meal name is required" };

  const mealType = (["breakfast", "lunch", "dinner", "snack"].includes(
    input.meal_type ?? ""
  )
    ? input.meal_type
    : "snack") as MealType;

  const date = input.date?.trim() || todayKey();
  const result = await logCustomMeal(auth.userId, date, {
    meal_type: mealType,
    name,
    description: input.description?.trim() || "",
    macros: {
      calories: Math.max(0, Math.round(input.calories ?? 0)),
      protein: Math.max(0, Math.round(input.protein ?? 0)),
      carbs: Math.max(0, Math.round(input.carbs ?? 0)),
      fat: Math.max(0, Math.round(input.fat ?? 0)),
    },
    ingredients: [],
  });

  if (result && "error" in result && result.error) return { error: result.error };
  return {
    success: true as const,
    message: `Logged ${name} (${mealType}) for ${date}.`,
  };
}

/** Soft: log body weight. */
export async function coachLogWeightCommand(input: {
  weight_kg: number;
  date?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const weight = asNumber(input.weight_kg);
  if (weight == null) return { error: "Weight is required" };
  const date = input.date?.trim() || todayKey();
  const result = await upsertBodyWeightLog(auth.userId, date, weight);
  if (result && "error" in result && result.error) return { error: result.error };
  return {
    success: true as const,
    message: `Logged ${weight} kg for ${date}.`,
  };
}

/** Habits scheduled for today (for coach chat). */
export async function coachListTodayHabitsCommand() {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const date = todayKey();
  const habits = await getHabitsWithCompletions(auth.userId, date);
  if (habits.length === 0) {
    return { text: "No habits scheduled for today." };
  }
  const lines = habits.map(
    (h) =>
      `- ${h.title} id=${h.id} status=${h.status} completed=${h.completed}`
  );
  return { text: lines.join("\n") };
}

/** Soft: mark a habit complete for today. */
export async function coachCompleteHabitCommand(input: {
  habit_id?: string;
  habit_name?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const date = todayKey();
  const habits = await getHabitsWithCompletions(auth.userId, date);
  if (habits.length === 0) {
    return { error: "No habits scheduled for today" };
  }

  let habitId = input.habit_id?.trim() || "";
  if (!habitId && input.habit_name?.trim()) {
    const q = input.habit_name.trim().toLowerCase();
    const matches = habits.filter((h) => h.title.toLowerCase().includes(q));
    if (matches.length === 1) {
      habitId = matches[0]!.id;
    } else if (matches.length > 1) {
      return {
        error: `Multiple habits match "${input.habit_name}". Call list_today_habits and use habit_id.`,
      };
    } else {
      return { error: `No habit matching "${input.habit_name}" today.` };
    }
  }

  if (!habitId) {
    return { error: "Provide habit_id or habit_name" };
  }

  const habit = habits.find((h) => h.id === habitId);
  if (!habit) {
    return { error: "Habit not found for today. Call list_today_habits." };
  }
  if (habit.completed) {
    return {
      success: true as const,
      message: `"${habit.title}" was already marked complete for ${date}.`,
    };
  }

  const result = await toggleHabitCompletion(habitId, date);
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  return {
    success: true as const,
    message: `Marked "${habit.title}" complete for ${date}.`,
  };
}

/** Soft: add water (ml). */
export async function coachLogWaterCommand(input: {
  amount_ml: number;
  date?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const amount = asNumber(input.amount_ml);
  if (amount == null || amount <= 0) return { error: "Amount must be a positive number of ml" };
  const date = input.date?.trim() || todayKey();
  const result = await addWater(auth.userId, date, Math.round(amount));
  if (result && "error" in result && result.error) return { error: result.error };
  return {
    success: true as const,
    message: `Added ${Math.round(amount)} ml water for ${date}.`,
  };
}

/** Schedule a personal workout plan across weekdays for N weeks (used by Confirm + Apply). */
export async function scheduleWorkoutPlanDays(input: {
  planId: string;
  weeks: number;
  weekdays: number[];
  startDate?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, is_personal, created_by")
    .eq("id", input.planId)
    .maybeSingle();

  if (!plan || !(plan.is_personal && plan.created_by === auth.userId)) {
    return { error: "Workout plan not found" };
  }

  const { data: days } = await admin
    .from("workout_days")
    .select("id, day_index")
    .eq("plan_id", input.planId)
    .order("day_index");

  if (!days?.length) return { error: "This workout has no days to schedule" };

  const weekdays =
    input.weekdays.length > 0
      ? input.weekdays
      : days.length >= 4
        ? [1, 2, 4, 5]
        : days.length === 3
          ? [1, 3, 5]
          : days.length === 2
            ? [1, 4]
            : [1];

  const startDate = input.startDate?.trim() || todayKey();
  const weeks = Math.min(52, Math.max(1, Math.round(input.weeks) || 4));
  let count = 0;

  // When the client named weekdays, schedule one session per weekday (cycle plan
  // days if the plan is shorter). Otherwise map each plan day to a default weekday.
  if (input.weekdays.length > 0) {
    for (let i = 0; i < weekdays.length; i++) {
      const weekday = weekdays[i]!;
      const day = days[i % days.length]!;
      const result = await scheduleWorkoutSeries({
        startDate,
        weekdays: [weekday],
        weeks,
        planId: input.planId,
        dayId: day.id as string,
      });
      if (result.error) return { error: result.error };
      count += "count" in result ? (result.count as number) : 0;
    }
  } else {
    for (let i = 0; i < days.length; i++) {
      const weekday = weekdays[i % weekdays.length]!;
      const result = await scheduleWorkoutSeries({
        startDate,
        weekdays: [weekday],
        weeks,
        planId: input.planId,
        dayId: days[i].id as string,
      });
      if (result.error) return { error: result.error };
      count += "count" in result ? (result.count as number) : 0;
    }
  }

  return { success: true as const, count };
}

/**
 * Execute a confirmed Coach Alex pending action.
 * Always re-checks auth and ownership server-side.
 */
export async function confirmCoachPendingAction(
  action: CoachPendingAction
): Promise<{ success: true; message: string } | { error: string }> {
  const auth = await requireUser();
  if ("error" in auth) {
    return { error: "Not authenticated" };
  }

  const payload = action.payload ?? {};

  try {
    switch (action.kind) {
      case "delete_workout_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing workout plan" };
        const result = await deletePersonalWorkoutPlan(planId);
        if (result?.error) return { error: result.error };
        return { success: true, message: "Workout deleted." };
      }
      case "delete_nutrition_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing nutrition plan" };
        const result = await deletePersonalNutritionPlan(planId);
        if (result?.error) return { error: result.error };
        return { success: true, message: "Nutrition plan deleted." };
      }
      case "clear_workout_schedule": {
        const planId = asString(payload.planId);
        const clearAll = payload.clearAll === true;
        const weekdays = asNumberArray(payload.weekdays);
        const kinds = Array.isArray(payload.kinds)
          ? payload.kinds.map(String).filter(Boolean)
          : [];
        const result = await clearUpcomingWorkoutSchedule({
          planId,
          clearAll,
          weekdays,
          kinds,
        });
        if ("error" in result) return { error: result.error };
        const removed = result.removed;
        return {
          success: true,
          message:
            removed < 0
              ? "Workout schedule cleared."
              : removed === 0
                ? "Nothing matched — schedule unchanged."
                : `Cleared ${removed} upcoming workout session(s).`,
        };
      }
      case "clear_nutrition_schedule": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing nutrition plan" };
        const result = await clearNutritionSchedule(planId);
        if (result?.error) return { error: result.error };
        return { success: true, message: "Nutrition schedule cleared." };
      }
      case "assign_workout_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing workout plan" };
        const result = await assignPersonalWorkoutPlan(planId);
        if (result?.error) return { error: result.error };
        return { success: true, message: "Workout set as your active program." };
      }
      case "assign_nutrition_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing nutrition plan" };
        const result = await assignPersonalNutritionPlan(planId);
        if (result?.error) return { error: result.error };
        return { success: true, message: "Nutrition plan set as active." };
      }
      case "schedule_workout_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing workout plan" };
        const weeks = asNumber(payload.weeks) ?? 4;
        const weekdays = asNumberArray(payload.weekdays);
        const startDate = asString(payload.startDate) ?? undefined;
        const result = await scheduleWorkoutPlanDays({
          planId,
          weeks,
          weekdays,
          startDate,
        });
        if ("error" in result && result.error) return { error: result.error };
        const count = "count" in result ? result.count : 0;
        return {
          success: true,
          message: `Scheduled ${count} workout session(s) over ${weeks} week(s).`,
        };
      }
      case "schedule_nutrition_plan": {
        const planId = asString(payload.planId);
        if (!planId) return { error: "Missing nutrition plan" };
        const weeks = asNumber(payload.weeks) ?? 4;
        const weekdays = asNumberArray(payload.weekdays);
        const startDate = asString(payload.startDate) || todayKey();
        const resolvedWeekdays =
          weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6];
        const result = await scheduleNutritionSeries({
          startDate,
          weekdays: resolvedWeekdays,
          weeks: Math.min(52, Math.max(1, Math.round(weeks))),
          planId,
        });
        if (result?.error) return { error: result.error };
        const count = "count" in result ? result.count : 0;
        return {
          success: true,
          message: `Scheduled nutrition on ${count} day(s) over ${weeks} week(s).`,
        };
      }
      case "update_health_lifestyle": {
        const updates = (payload.updates ?? {}) as IntakeResponses;
        const { data: profile } = await auth.supabase
          .from("profiles")
          .select("*")
          .eq("id", auth.userId)
          .single();
        if (!profile) return { error: "Profile not found" };

        const existing = profileToResponses(profile as Profile);
        const merged = normalizeIntakeResponses({
          ...existing,
          ...updates,
        });
        const result = await updateClientIntakeFromResponses(merged);
        if (result && "error" in result && result.error) {
          return { error: result.error };
        }
        return { success: true, message: "Health & lifestyle profile updated." };
      }
      default:
        return { error: "Unknown action" };
    }
  } catch (error) {
    console.error("[confirmCoachPendingAction]", error);
    return {
      error: error instanceof Error ? error.message : "Could not complete action",
    };
  } finally {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    revalidatePath("/dashboard/nutrition");
    revalidatePath("/dashboard/profile");
  }
}

/** Used by tools to load day titles when describing a schedule preview. */
export async function getWorkoutPlanDaysSummary(planId: string) {
  const admin = createAdminClient();
  const { data: days } = await admin
    .from("workout_days")
    .select("id, title, day_index, exercises(id)")
    .eq("plan_id", planId)
    .order("day_index");
  return (days ?? []).map((d) => ({
    id: d.id as string,
    title: (d.title as string) || "Day",
    exercises: Array.isArray(d.exercises) ? d.exercises.length : 0,
  }));
}
