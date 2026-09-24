"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import { logCustomMeal } from "@/lib/actions/daily-meals";
import { upsertBodyWeightLog } from "@/lib/actions/weight-logs";
import { addWater, updateNutritionTargets, updateWaterGoal } from "@/lib/actions/logs";
import {
  deleteHabit,
  getClientHabits,
  getHabitsWithCompletions,
  saveHabit,
  toggleHabitCompletion,
  type SaveHabitInput,
} from "@/lib/actions/habits";
import { updateCalorieTarget } from "@/lib/actions/profile";
import { PROFILE_GOAL_KEYS } from "@/lib/goal-coaching";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import {
  createClientCardio,
  deleteClientCardio,
  getClientCardioList,
  getScheduledCardiosForDate,
  scheduleCardioSeries,
} from "@/lib/actions/user-cardio";
import {
  resolveWorkoutsForDate,
  startTodaysWorkoutAndRedirect,
} from "@/lib/actions/workout-sessions";
import {
  assignPersonalWorkoutPlan,
  clearUpcomingWorkoutSchedule,
  deletePersonalWorkoutPlan,
  getPersonalWeekPlans,
  getPersonalWorkoutsWithSchedules,
  getUpcomingWorkoutScheduleSummary,
  schedulePersonalWeekPlan,
  scheduleWorkoutSeries,
} from "@/lib/actions/user-workouts";
import {
  isWeekPlanScheduleActive,
  normalizeWeekPlanConfig,
} from "@/lib/week-plan";
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
  // Prefer the same single-day filter as the Workouts tab.
  const withSchedules = await getPersonalWorkoutsWithSchedules();
  void userId;
  const nonOneOff = withSchedules.filter(
    (item) => !isOneOffCalendarPlan(item.plan.description)
  );
  const oneOffCount = withSchedules.length - nonOneOff.length;
  return {
    plans: nonOneOff.map(({ plan, days }) => ({
      id: plan.id,
      title: plan.title,
      kind: plan.kind ?? "strength",
      description: plan.description ?? null,
      dayCount: days.length,
    })),
    oneOffCount,
  };
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function listCoachWeekPlans() {
  const plans = await getPersonalWeekPlans();
  return plans.map((p) => {
    const weekdays = [
      ...new Set(p.config.days.map((d) => d.weekday).filter((d) => d >= 0 && d <= 6)),
    ].sort((a, b) => a - b);
    const dayLabels = p.config.days
      .map((d) => {
        const wd = WEEKDAY_SHORT[d.weekday] ?? "?";
        return `${wd}: ${d.focus}`;
      })
      .join("; ");
    return {
      id: p.id,
      title: p.title,
      dayCount: p.config.days.length,
      includeExtras: p.config.includeExtras,
      weekdays,
      dayLabels,
      scheduled: isWeekPlanScheduleActive(p.config),
      scheduledWeeks: p.config.scheduledWeeks ?? null,
    };
  });
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
): Promise<{
  id: string;
  title: string;
  dayCount: number;
  kind: string;
} | null> {
  const auth = await requireUser();
  if ("error" in auth) return null;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, title, kind, week_config")
    .eq("id", planId)
    .eq("created_by", auth.userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (!plan) return null;

  const kind = ((plan.kind as string | null) ?? "strength") as string;
  if (kind === "week") {
    const config = normalizeWeekPlanConfig(plan.week_config);
    return {
      id: plan.id as string,
      title: (plan.title as string) || "Week plan",
      dayCount: config?.days.length ?? 0,
      kind,
    };
  }

  const { data: days } = await admin
    .from("workout_days")
    .select("id")
    .eq("plan_id", planId);
  return {
    id: plan.id as string,
    title: (plan.title as string) || "Workout",
    dayCount: days?.length ?? 0,
    kind,
  };
}

export async function resolveWeekPlanLabel(
  weekPlanId: string
): Promise<{
  id: string;
  title: string;
  dayCount: number;
  includeExtras: boolean;
  weekdays: number[];
  dayLabels: string;
} | null> {
  const auth = await requireUser();
  if ("error" in auth) return null;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, title, kind, week_config")
    .eq("id", weekPlanId)
    .eq("created_by", auth.userId)
    .eq("is_personal", true)
    .eq("kind", "week")
    .maybeSingle();
  if (!plan) return null;

  const config = normalizeWeekPlanConfig(plan.week_config);
  if (!config?.days.length) return null;

  const weekdays = [
    ...new Set(config.days.map((d) => d.weekday).filter((d) => d >= 0 && d <= 6)),
  ].sort((a, b) => a - b);

  return {
    id: plan.id as string,
    title: (plan.title as string) || "Week plan",
    dayCount: config.days.length,
    includeExtras: config.includeExtras,
    weekdays,
    dayLabels: config.days
      .map((d) => `${WEEKDAY_SHORT[d.weekday] ?? "?"}: ${d.focus}`)
      .join("; "),
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

/** Soft: update daily macro targets (absolute grams preferred). */
export async function coachUpdateMacrosCommand(input: {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  protein_pct?: number;
  carbs_pct?: number;
  fat_pct?: number;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const calories = asNumber(input.calories);
  const proteinG = asNumber(input.protein_g);
  const carbsG = asNumber(input.carbs_g);
  const fatG = asNumber(input.fat_g);
  const proteinPct = asNumber(input.protein_pct);
  const carbsPct = asNumber(input.carbs_pct);
  const fatPct = asNumber(input.fat_pct);

  const hasGrams =
    proteinG != null || carbsG != null || fatG != null || calories != null;
  const hasPct =
    proteinPct != null && carbsPct != null && fatPct != null && calories != null;

  if (hasPct && calories != null && proteinG == null && carbsG == null && fatG == null) {
    const result = await updateCalorieTarget({
      calories,
      proteinPct: proteinPct!,
      carbsPct: carbsPct!,
      fatPct: fatPct!,
    });
    if ("error" in result && result.error) return { error: result.error };
    const t = "targets" in result ? result.targets : null;
    return {
      success: true as const,
      message: t
        ? `Updated macros to ${t.calories} kcal · P${t.protein}g · C${t.carbs}g · F${t.fat}g.`
        : "Updated daily macros.",
    };
  }

  if (
    calories == null &&
    proteinG == null &&
    carbsG == null &&
    fatG == null
  ) {
    return {
      error:
        "Provide calories and/or protein_g / carbs_g / fat_g (or calories + protein_pct/carbs_pct/fat_pct).",
    };
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("target_calories, target_protein, target_carbs, target_fat")
    .eq("id", auth.userId)
    .single();

  if (!profile) return { error: "Profile not found" };

  const next = {
    calories: calories ?? Number(profile.target_calories) ?? 2000,
    protein: proteinG ?? Number(profile.target_protein) ?? 150,
    carbs: carbsG ?? Number(profile.target_carbs) ?? 200,
    fat: fatG ?? Number(profile.target_fat) ?? 60,
  };

  const result = await updateNutritionTargets(auth.userId, next);
  if (result && "error" in result && result.error) return { error: result.error };
  return {
    success: true as const,
    message: `Updated macros to ${next.calories} kcal · P${next.protein}g · C${next.carbs}g · F${next.fat}g.`,
  };
}

/** Soft: update water goal (ml/day). */
export async function coachUpdateWaterGoalCommand(input: {
  water_goal_ml: number;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const goal = asNumber(input.water_goal_ml);
  if (goal == null) return { error: "water_goal_ml is required" };
  const result = await updateWaterGoal(auth.userId, Math.round(goal));
  if (result && "error" in result && result.error) return { error: result.error };
  return {
    success: true as const,
    message: `Water goal set to ${Math.round(goal)} ml/day.`,
  };
}

/** Soft: update profile settings (name, phone, goal, language, units). */
export async function coachUpdateProfileSettingsCommand(input: {
  full_name?: string;
  phone?: string | null;
  goal?: string | null;
  preferred_locale?: string;
  unit_system?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const { data: existing } = await auth.supabase
    .from("profiles")
    .select("full_name, phone, goal, preferred_locale, unit_system, intake_responses")
    .eq("id", auth.userId)
    .single();

  if (!existing) return { error: "Profile not found" };

  const fullName =
    typeof input.full_name === "string" && input.full_name.trim()
      ? input.full_name.trim()
      : (existing.full_name as string) || "";
  if (!fullName) return { error: "Name is required" };

  const phone =
    input.phone === undefined
      ? ((existing.phone as string | null) ?? null)
      : input.phone === null || input.phone === ""
        ? null
        : String(input.phone).trim();

  const allowedGoals = new Set<string>(PROFILE_GOAL_KEYS);
  let goal: string | null = (existing.goal as string | null) ?? null;
  if (input.goal !== undefined) {
    if (input.goal === null || input.goal === "") {
      goal = null;
    } else if (allowedGoals.has(input.goal)) {
      goal = input.goal;
    } else {
      return {
        error: `Invalid goal. Use one of: ${PROFILE_GOAL_KEYS.join(", ")}`,
      };
    }
  }

  const unitSystemRaw =
    input.unit_system?.trim() ||
    (existing.unit_system as string | null) ||
    "metric";
  if (unitSystemRaw !== "metric" && unitSystemRaw !== "imperial") {
    return { error: "unit_system must be metric or imperial" };
  }

  const preferredLocale = parseCheckoutLocale(
    input.preferred_locale ?? (existing.preferred_locale as string | null)
  );

  const intakeResponses = {
    ...((existing.intake_responses as Record<string, unknown> | null) ?? {}),
  };
  if (goal) intakeResponses.goal = goal;
  else delete intakeResponses.goal;

  const profileUpdate: Record<string, unknown> = {
    full_name: fullName,
    phone,
    goal,
    preferred_locale: preferredLocale,
    intake_responses: intakeResponses,
    unit_system: unitSystemRaw,
  };

  let { error } = await auth.supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", auth.userId);

  if (error?.message?.includes("unit_system")) {
    const { unit_system: _u, ...withoutUnits } = profileUpdate;
    ({ error } = await auth.supabase
      .from("profiles")
      .update(withoutUnits)
      .eq("id", auth.userId));
  }

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/profile");

  const changed: string[] = [];
  if (input.full_name !== undefined) changed.push(`name=${fullName}`);
  if (input.phone !== undefined) changed.push(`phone=${phone ?? "cleared"}`);
  if (input.goal !== undefined) changed.push(`goal=${goal ?? "cleared"}`);
  if (input.preferred_locale !== undefined) {
    changed.push(`language=${preferredLocale}`);
  }
  if (input.unit_system !== undefined) changed.push(`units=${unitSystemRaw}`);

  return {
    success: true as const,
    message:
      changed.length > 0
        ? `Updated profile: ${changed.join(", ")}.`
        : "Profile saved.",
  };
}

/** List all personal habits (library), not only today's schedule. */
export async function coachListAllHabitsCommand() {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const habits = await getClientHabits(auth.userId);
  if (habits.length === 0) {
    return { text: "No habits saved yet." };
  }
  const lines = habits.map((h) => {
    const days = (h.weekdays ?? []).join(",");
    return `- ${h.title} id=${h.id} weekdays=[${days}] weeks=${h.repeat_weeks ?? "?"}`;
  });
  return { text: lines.join("\n") };
}

/** Soft: create or update a habit. */
export async function coachSaveHabitCommand(input: {
  habit_id?: string;
  title: string;
  weekdays?: number[];
  weeks?: number;
  time_start?: string | null;
  time_end?: string | null;
  start_mode?: "now" | "next_week";
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const title = input.title.trim();
  if (!title) return { error: "Habit title is required" };

  let weekdays =
    Array.isArray(input.weekdays) && input.weekdays.length > 0
      ? input.weekdays.filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
      : [0, 1, 2, 3, 4, 5, 6];
  if (weekdays.length === 0) weekdays = [0, 1, 2, 3, 4, 5, 6];

  const payload: SaveHabitInput = {
    title,
    weekdays,
    weeks: Math.min(52, Math.max(1, Math.round(asNumber(input.weeks) ?? 12))),
    timeStart: input.time_start ?? null,
    timeEnd: input.time_end ?? null,
    startMode: input.start_mode === "next_week" ? "next_week" : "now",
  };

  const result = await saveHabit(
    auth.userId,
    payload,
    input.habit_id?.trim() || undefined
  );
  if ("error" in result) return { error: result.error };

  const name = result.data?.title ?? title;
  return {
    success: true as const,
    message: input.habit_id
      ? `Updated habit "${name}".`
      : `Added habit "${name}".`,
    habitId: result.data?.id,
  };
}

/** Resolve habit id for delete confirm (by id or name). */
export async function resolveHabitForCoach(input: {
  habit_id?: string;
  habit_name?: string;
}): Promise<{ id: string; title: string } | { error: string }> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error ?? "Not authenticated" };

  const habits = await getClientHabits(auth.userId);
  if (habits.length === 0) return { error: "No habits found" };

  if (input.habit_id?.trim()) {
    const hit = habits.find((h) => h.id === input.habit_id!.trim());
    if (!hit) return { error: "Habit not found. Call list_my_habits." };
    return { id: hit.id, title: hit.title };
  }

  if (input.habit_name?.trim()) {
    const q = input.habit_name.trim().toLowerCase();
    const matches = habits.filter((h) => h.title.toLowerCase().includes(q));
    if (matches.length === 1) {
      return { id: matches[0]!.id, title: matches[0]!.title };
    }
    if (matches.length > 1) {
      return {
        error: `Multiple habits match "${input.habit_name}". Call list_my_habits and use habit_id.`,
      };
    }
    return { error: `No habit matching "${input.habit_name}".` };
  }

  return { error: "Provide habit_id or habit_name" };
}

export async function coachDeleteHabitById(habitId: string) {
  const result = await deleteHabit(habitId);
  if (result && "error" in result && result.error) return { error: result.error };
  return { success: true as const };
}

/** Soft: start today's next workout session and return session URL. */
export async function coachStartWorkoutCommand(input?: {
  date?: string;
  scheduled_workout_id?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const date = input?.date?.trim() || todayKey();
  const workouts = await resolveWorkoutsForDate(auth.userId, date);
  if (workouts.length === 0) {
    return { error: `No workout scheduled for ${date}` };
  }

  const result = await startTodaysWorkoutAndRedirect(date, {
    scheduledWorkoutId: input?.scheduled_workout_id ?? null,
    dayFlow: !input?.scheduled_workout_id,
  });

  if (result && "error" in result && result.error) {
    if ("sessionId" in result && result.sessionId) {
      return {
        success: true as const,
        message: result.error,
        navigate: `/dashboard/workout/session/${result.sessionId}`,
      };
    }
    return { error: result.error };
  }

  if (!result || !("sessionId" in result) || !result.sessionId) {
    return { error: "Could not start workout" };
  }

  return {
    success: true as const,
    message: `Started workout for ${date}. Opening the session now.`,
    navigate: `/dashboard/workout/session/${result.sessionId}`,
  };
}

/** Soft: open today's cardio session (timer page). */
export async function coachStartCardioCommand(input?: {
  date?: string;
  cardio_id?: string;
  cardio_name?: string;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const date = input?.date?.trim() || todayKey();
  const scheduled = await getScheduledCardiosForDate(auth.userId, date);
  const library = await getClientCardioList();

  let cardioId = input?.cardio_id?.trim() || "";
  if (!cardioId && input?.cardio_name?.trim()) {
    const q = input.cardio_name.trim().toLowerCase();
    const fromToday = scheduled.filter((s) =>
      (s.client_cardio?.title ?? "").toLowerCase().includes(q)
    );
    const fromLib = library.filter((c) => c.title.toLowerCase().includes(q));
    const hits =
      fromToday.length > 0
        ? fromToday.map((s) => ({
            id: s.cardio_id,
            title: s.client_cardio?.title ?? "Cardio",
          }))
        : fromLib.map((c) => ({ id: c.id, title: c.title }));
    if (hits.length === 1) cardioId = hits[0]!.id;
    else if (hits.length > 1) {
      return {
        error: `Multiple cardio match "${input.cardio_name}". Call list_my_cardio / list_today_cardio and use cardio_id.`,
      };
    } else {
      return { error: `No cardio matching "${input.cardio_name}".` };
    }
  }

  if (!cardioId) {
    if (scheduled.length === 1) {
      cardioId = scheduled[0]!.cardio_id;
    } else if (scheduled.length > 1) {
      return {
        error:
          "Multiple cardio sessions today. Call list_today_cardio and pass cardio_id.",
      };
    } else if (library.length === 1) {
      cardioId = library[0]!.id;
    } else {
      return {
        error:
          "No cardio scheduled today. Create/schedule one first, or pass cardio_id.",
      };
    }
  }

  const title =
    scheduled.find((s) => s.cardio_id === cardioId)?.client_cardio?.title ??
    library.find((c) => c.id === cardioId)?.title ??
    "Cardio";

  const href = `/dashboard/workout/cardio/session?date=${encodeURIComponent(date)}&cardioId=${encodeURIComponent(cardioId)}`;
  return {
    success: true as const,
    message: `Opening “${title}” cardio for ${date}.`,
    navigate: href,
  };
}

export async function coachListMyCardioCommand() {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };
  const list = await getClientCardioList();
  if (list.length === 0) return { text: "No cardio sessions saved yet." };
  return {
    text: list
      .map(
        (c) =>
          `- ${c.title} id=${c.id}${
            c.duration_minutes != null ? ` · ${c.duration_minutes} min` : ""
          }`
      )
      .join("\n"),
  };
}

export async function coachListTodayCardioCommand(date?: string) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };
  const dateKey = date?.trim() || todayKey();
  const scheduled = await getScheduledCardiosForDate(auth.userId, dateKey);
  if (scheduled.length === 0) {
    return { text: `No cardio scheduled for ${dateKey}.` };
  }
  return {
    text: scheduled
      .map(
        (s) =>
          `- ${s.client_cardio?.title ?? "Cardio"} cardio_id=${s.cardio_id} schedule_id=${s.id}`
      )
      .join("\n"),
  };
}

export async function coachListTodayWorkoutsCommand(date?: string) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };
  const dateKey = date?.trim() || todayKey();
  const workouts = await resolveWorkoutsForDate(auth.userId, dateKey);
  if (workouts.length === 0) {
    return { text: `No workouts scheduled for ${dateKey}.` };
  }
  return {
    text: workouts
      .map(
        (w) =>
          `- ${w.dayTitle ?? w.planTitle ?? "Workout"} plan_id=${w.planId} day_id=${w.dayId} scheduled_workout_id=${w.scheduledWorkoutId ?? "none"} kind=${w.planKind ?? "strength"}`
      )
      .join("\n"),
  };
}

export async function coachAddCardioCommand(input: {
  title: string;
  description?: string;
  duration_minutes?: number;
  youtube_url?: string;
}) {
  const result = await createClientCardio({
    title: input.title,
    description: input.description,
    durationMinutes: input.duration_minutes,
    youtubeUrl: input.youtube_url,
  });
  if ("error" in result && result.error) return { error: result.error };
  const data = "data" in result ? result.data : null;
  return {
    success: true as const,
    message: `Added cardio “${data?.title ?? input.title.trim()}”.`,
    cardioId: data?.id,
  };
}

export async function resolveCardioForCoach(input: {
  cardio_id?: string;
  cardio_name?: string;
}): Promise<{ id: string; title: string } | { error: string }> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error ?? "Not authenticated" };

  const list = await getClientCardioList();
  if (list.length === 0) return { error: "No cardio found" };

  if (input.cardio_id?.trim()) {
    const hit = list.find((c) => c.id === input.cardio_id!.trim());
    if (!hit) return { error: "Cardio not found. Call list_my_cardio." };
    return { id: hit.id, title: hit.title };
  }

  if (input.cardio_name?.trim()) {
    const q = input.cardio_name.trim().toLowerCase();
    const matches = list.filter((c) => c.title.toLowerCase().includes(q));
    if (matches.length === 1) {
      return { id: matches[0]!.id, title: matches[0]!.title };
    }
    if (matches.length > 1) {
      return {
        error: `Multiple cardio match "${input.cardio_name}". Call list_my_cardio and use cardio_id.`,
      };
    }
    return { error: `No cardio matching "${input.cardio_name}".` };
  }

  return { error: "Provide cardio_id or cardio_name" };
}

export async function coachScheduleCardioById(input: {
  cardioId: string;
  weekdays: number[];
  weeks: number;
  startMode?: "now" | "next_week";
}) {
  return scheduleCardioSeries({
    cardioId: input.cardioId,
    weekdays: input.weekdays,
    weeks: input.weeks,
    startMode: input.startMode === "next_week" ? "next_week" : "now",
  });
}

export async function coachDeleteCardioById(cardioId: string) {
  const result = await deleteClientCardio(cardioId);
  if (result && "error" in result && result.error) return { error: result.error };
  return { success: true as const };
}

/** Clear upcoming scheduled cardio rows (from today onward). */
export async function coachClearCardioSchedule(input: {
  cardioId?: string | null;
  clearAll?: boolean;
}) {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const today = todayKey();
  let query = admin
    .from("scheduled_cardio")
    .delete({ count: "exact" })
    .eq("client_id", auth.userId)
    .gte("scheduled_date", today);

  if (input.cardioId) {
    query = query.eq("cardio_id", input.cardioId);
  } else if (!input.clearAll) {
    return { error: "Provide cardioId or clearAll=true" };
  }

  const { error, count } = await query;
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout/cardio");
  return { success: true as const, removed: count ?? 0 };
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
    .select("id, is_personal, created_by, kind, week_config")
    .eq("id", input.planId)
    .maybeSingle();

  if (!plan || !(plan.is_personal && plan.created_by === auth.userId)) {
    return { error: "Workout plan not found" };
  }

  // Week templates schedule via week_config (mains + optional warm-up/stretch).
  const kind = ((plan.kind as string | null) ?? "strength") as string;
  if (kind === "week") {
    const result = await schedulePersonalWeekPlan({
      weekPlanId: input.planId,
      weeks: input.weeks,
      startDate: input.startDate,
    });
    if ("error" in result && result.error) return { error: result.error };
    return {
      success: true as const,
      count: "count" in result ? result.count : 0,
    };
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
      case "schedule_week_plan": {
        const weekPlanId =
          asString(payload.weekPlanId) ?? asString(payload.planId);
        if (!weekPlanId) return { error: "Missing week plan" };
        const weeks = asNumber(payload.weeks) ?? 4;
        const startDate = asString(payload.startDate) ?? undefined;
        const result = await schedulePersonalWeekPlan({
          weekPlanId,
          weeks,
          startDate,
        });
        if ("error" in result && result.error) return { error: result.error };
        const count = "count" in result ? result.count : 0;
        return {
          success: true,
          message: `Scheduled week plan — ${count} session(s) over ${weeks} week(s).`,
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
      case "delete_habit": {
        const habitId = asString(payload.habitId);
        if (!habitId) return { error: "Missing habit" };
        const result = await coachDeleteHabitById(habitId);
        if ("error" in result && result.error) return { error: result.error };
        const title = asString(payload.title) ?? "Habit";
        return { success: true, message: `Deleted habit “${title}”.` };
      }
      case "delete_cardio": {
        const cardioId = asString(payload.cardioId);
        if (!cardioId) return { error: "Missing cardio" };
        const result = await coachDeleteCardioById(cardioId);
        if ("error" in result && result.error) return { error: result.error };
        const title = asString(payload.title) ?? "Cardio";
        return { success: true, message: `Deleted cardio “${title}”.` };
      }
      case "schedule_cardio": {
        const cardioId = asString(payload.cardioId);
        if (!cardioId) return { error: "Missing cardio" };
        const weeks = asNumber(payload.weeks) ?? 4;
        const weekdays = asNumberArray(payload.weekdays);
        const startMode =
          payload.startMode === "next_week" ? "next_week" : "now";
        const result = await coachScheduleCardioById({
          cardioId,
          weekdays: weekdays.length > 0 ? weekdays : [1, 3, 5],
          weeks,
          startMode,
        });
        if (result && "error" in result && result.error) {
          return { error: result.error };
        }
        const count = result && "count" in result ? result.count : 0;
        return {
          success: true,
          message: `Scheduled cardio on ${count} day(s) over ${weeks} week(s).`,
        };
      }
      case "clear_cardio_schedule": {
        const cardioId = asString(payload.cardioId);
        const clearAll = payload.clearAll === true;
        const result = await coachClearCardioSchedule({
          cardioId,
          clearAll,
        });
        if ("error" in result && result.error) return { error: result.error };
        const removed = "removed" in result ? result.removed : 0;
        return {
          success: true,
          message:
            removed === 0
              ? "Nothing matched — cardio schedule unchanged."
              : `Cleared ${removed} upcoming cardio session(s).`,
        };
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
  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, kind, week_config")
    .eq("id", planId)
    .maybeSingle();

  if (plan && ((plan.kind as string | null) ?? "strength") === "week") {
    const config = normalizeWeekPlanConfig(plan.week_config);
    return (config?.days ?? []).map((d, i) => ({
      id: `week-day-${i}`,
      title: `${WEEKDAY_SHORT[d.weekday] ?? "Day"}: ${d.focus}`,
      exercises: 0,
    }));
  }

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
