"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import {
  checkAiPlanApplyAllowed,
  consumeAiPlanApply,
  ensureManualPlanCreation,
} from "@/lib/actions/usage-limits";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { hasAiPlanBuilderAccess } from "@/lib/subscription-limits";
import { isAiConfigured } from "@/lib/ai/providers";
import { formatUserError } from "@/lib/format-user-error";
import { generateWorkoutPlanFromProfile, generateWorkoutSessionFromProfile, generateFullTrainingDayFromProfile } from "@/lib/ai/generate-workout-plan";
import type { AiDaySessionResult, AiDayProgramResult } from "@/lib/ai/generate-workout-plan";
import { inferAiMainWorkoutKind } from "@/lib/ai/infer-workout-kind";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import { saveWorkoutDay } from "@/lib/actions/plans";
import { createPersonalWorkoutPlan, assignPersonalWorkoutPlan, addWorkoutToDay, getPersonalWorkoutPlanWithDetails, createPersonalWeekPlan } from "@/lib/actions/user-workouts";
import { savePersonalHiitPlan } from "@/lib/actions/user-hiit";
import { scheduleWorkoutPlanDays } from "@/lib/actions/coach-commands";
import { scheduleNutritionSeries } from "@/lib/actions/user-nutrition-schedule";
import { generateRecurringScheduleDates } from "@/lib/schedule-utils";
import type { AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import type { WorkoutPlanKind } from "@/lib/hiit";
import { isMainWorkoutKind } from "@/lib/hiit";
import {
  fingerprintStrengthExercises,
  fingerprintStrengthPlan,
} from "@/lib/workout-content-fingerprint";
import {
  createPersonalNutritionPlan,
  assignPersonalNutritionPlan,
  addMealToDayMenuSlot,
} from "@/lib/actions/user-nutrition";
import { savePlanGroceryList } from "@/lib/actions/grocery-list";
import {
  buildWeeklyGroceryListFromMeals,
  normalizeGroceryList,
} from "@/lib/grocery-list-utils";
import { updateNutritionTargets } from "@/lib/actions/logs";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import type { Profile } from "@/lib/types";
import type { MealSlot } from "@/lib/meal-slots";

async function requireAiPlanBuilder(): Promise<
  | { success: true; profile: Profile }
  | { success: false; error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { success: false, error: "Not authenticated" };
  if (!hasAiPlanBuilderAccess(profile)) {
    return { success: false, error: `Upgrade to ${PLATFORM_AI_NAME} to build plans with AI Coach.` };
  }
  if (!isAiConfigured()) {
    return { success: false, error: "AI is not configured on the server yet." };
  }
  return { success: true, profile: profile as Profile };
}

export async function getAiPlanBuilderProfile(): Promise<
  | { profile: Profile; intakeComplete: boolean }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  return {
    profile: profile as Profile,
    intakeComplete: isClientIntakeComplete(profile as Profile),
  };
}

export async function generateAiWorkoutPlanAction(
  preferences?: string,
  kind?: WorkoutPlanKind | null
): Promise<{ plan: AiWorkoutPlanResult } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const plan = await generateWorkoutPlanFromProfile(access.profile, preferences, kind);
    return { plan };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to generate workout plan"),
    };
  }
}

export async function generateAiWorkoutDayAction(
  prompt: string,
  explicitKind?: import("@/lib/hiit").WorkoutPlanKind | null
): Promise<{ session: AiDaySessionResult } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const session = await generateWorkoutSessionFromProfile(
      access.profile,
      prompt,
      explicitKind
    );
    return { session };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to generate workout"),
    };
  }
}

/** Full day: warm-up + main + stretching in one generate. */
export async function generateAiFullTrainingDayAction(
  prompt: string
): Promise<{ program: AiDayProgramResult; mainKind: "strength" | "hiit" } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const program = await generateFullTrainingDayFromProfile(access.profile, prompt);
    return { program, mainKind: inferAiMainWorkoutKind(prompt) };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to generate training day"),
    };
  }
}

async function scheduleAiSessionOnDate(
  dateKey: string,
  session: AiDaySessionResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  /** When set, schedule this existing plan instead of creating a new library copy. */
  existing?: { planId: string; dayId: string } | null
): Promise<{ planId: string } | { error: string }> {
  if (existing?.planId && existing?.dayId) {
    const scheduled = await addWorkoutToDay(
      dateKey,
      existing.planId,
      existing.dayId
    );
    if (scheduled.error) return { error: scheduled.error };
    return { planId: existing.planId };
  }

  if (
    session.kind === "hiit" ||
    session.kind === "warmup" ||
    session.kind === "stretch"
  ) {
    const plan = session.plan;
    if (!plan.config?.exercises?.length) {
      return {
        error:
          session.kind === "hiit"
            ? "No HIIT exercises to add"
            : "No interval exercises to add",
      };
    }

    if (session.kind === "hiit") {
      const { data: existingRows } = await admin
        .from("scheduled_workouts")
        .select("id, workout_plans(kind)")
        .eq("client_id", userId)
        .eq("scheduled_date", dateKey);
      const hasMain = (existingRows ?? []).some(
        (row: { workout_plans?: { kind?: string } | { kind?: string }[] | null }) => {
          const kind = Array.isArray(row.workout_plans)
            ? row.workout_plans[0]?.kind
            : row.workout_plans?.kind;
          return isMainWorkoutKind(kind);
        }
      );
      if (hasMain) {
        return {
          error: "This day already has a main workout.",
        };
      }
    }

    const saved = await savePersonalHiitPlan({
      title: plan.title,
      description:
        plan.description?.trim() ||
        (session.kind === "warmup"
          ? "AI Coach · warm-up · one-off session"
          : session.kind === "stretch"
            ? "AI Coach · stretching · one-off session"
            : "AI Coach · HIIT · one-off session"),
      config: plan.config,
      // Don't steal the active program assignment for warm-up / stretch extras.
      assign: session.kind === "hiit",
      kind: session.kind,
    });
    if (saved.error || !saved.data) {
      return {
        error:
          saved.error ??
          (session.kind === "hiit"
            ? "Could not create HIIT workout"
            : "Could not create interval session"),
      };
    }

    const scheduled = await addWorkoutToDay(
      dateKey,
      saved.data.id,
      saved.data.dayId
    );
    if (scheduled.error) return { error: scheduled.error };
    return { planId: saved.data.id };
  }

  const workout = session.workout;
  if (!workout.exercises?.length) return { error: "No exercises to add" };

  const title = workout.title?.trim() || "AI Workout";
  const strengthFp = fingerprintStrengthExercises(workout.exercises);

  if (strengthFp) {
    const { data: candidates } = await admin
      .from("workout_plans")
      .select("id")
      .eq("created_by", userId)
      .eq("is_personal", true)
      .eq("kind", "strength")
      .order("created_at", { ascending: false })
      .limit(60);

    for (const row of candidates ?? []) {
      const { data: days } = await admin
        .from("workout_days")
        .select(
          "id, exercises(name, sets, reps, rest_seconds, order_index)"
        )
        .eq("plan_id", row.id)
        .order("day_index");
      if (!days || days.length !== 1) continue;
      const day = days[0]!;
      const exercises = (
        (day.exercises as {
          name: string;
          sets: number | null;
          reps: string | null;
          rest_seconds: number | null;
          order_index: number | null;
        }[]) ?? []
      )
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const fp = fingerprintStrengthExercises(exercises);
      if (fp && fp === strengthFp) {
        const scheduled = await addWorkoutToDay(
          dateKey,
          row.id as string,
          day.id as string
        );
        if (scheduled.error) return { error: scheduled.error };
        return { planId: row.id as string };
      }
    }
  }

  const { data: plan, error: planError } = await admin
    .from("workout_plans")
    .insert({
      title,
      description: workout.description?.trim() || "AI Coach · one-off session",
      created_by: userId,
      is_personal: true,
      folder_id: null,
      kind: "strength",
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return { error: planError?.message ?? "Could not create workout" };
  }

  const planId = plan.id as string;

  const { data: day, error: dayError } = await admin
    .from("workout_days")
    .insert({
      plan_id: planId,
      day_index: 0,
      title,
    })
    .select("id")
    .single();

  if (dayError || !day) {
    await admin.from("workout_plans").delete().eq("id", planId);
    return { error: dayError?.message ?? "Could not save workout day" };
  }

  const dayId = day.id as string;
  const enriched = workout.exercises.map((ex) =>
    enrichExerciseWithGif({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes,
      image_url: ex.image_url,
      video_url: ex.video_url,
    })
  );

  const { error: exError } = await admin.from("exercises").insert(
    enriched.map((ex, i) => ({
      day_id: dayId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes ?? null,
      image_url: ex.image_url ?? null,
      video_url: ex.video_url ?? null,
      order_index: i,
    }))
  );

  if (exError) {
    await admin.from("workout_plans").delete().eq("id", planId);
    return { error: exError.message };
  }

  const scheduled = await addWorkoutToDay(dateKey, planId, dayId);
  if (scheduled.error) {
    await admin.from("workout_plans").delete().eq("id", planId);
    return { error: scheduled.error };
  }

  return { planId };
}

export async function applyAiWorkoutDayToDateAction(
  dateKey: string,
  session: AiDaySessionResult
): Promise<{ planId: string } | { error: string }> {
  try {
    const access = await requireAiPlanBuilder();
    if (!access.success) return { error: access.error };

    const createAccess = await ensureManualPlanCreation();
    if ("error" in createAccess) return { error: createAccess.error };
    const { admin, userId } = createAccess;

    const result = await scheduleAiSessionOnDate(dateKey, session, admin, userId);
    if ("error" in result) return result;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    return result;
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to add workout"),
    };
  }
}

/** Schedule warm-up + main + stretching for one calendar day. */
export async function applyAiFullTrainingDayToDateAction(
  dateKey: string,
  program: AiDayProgramResult
): Promise<{ planIds: string[] } | { error: string }> {
  try {
    const access = await requireAiPlanBuilder();
    if (!access.success) return { error: access.error };

    const createAccess = await ensureManualPlanCreation();
    if ("error" in createAccess) return { error: createAccess.error };
    const { admin, userId } = createAccess;

    const { data: existingRows } = await admin
      .from("scheduled_workouts")
      .select("id, workout_plans(kind)")
      .eq("client_id", userId)
      .eq("scheduled_date", dateKey);

    const existingKinds = new Set(
      (existingRows ?? []).map((row) => {
        const kind = Array.isArray(row.workout_plans)
          ? row.workout_plans[0]?.kind
          : (row.workout_plans as { kind?: string } | null)?.kind;
        return kind ?? null;
      })
    );

    if ([...existingKinds].some((k) => isMainWorkoutKind(k))) {
      return {
        error:
          "This day already has a main workout. Remove it first, or add only a warm-up / stretch from the library.",
      };
    }
    if (existingKinds.has("warmup") || existingKinds.has("stretch")) {
      return {
        error:
          "This day already has a warm-up or stretching session. Remove extras first to add a full AI day.",
      };
    }

    const sessions: AiDaySessionResult[] = [
      { kind: "warmup", plan: program.warmup },
      program.main,
      { kind: "stretch", plan: program.stretch },
    ];

    const planIds: string[] = [];
    for (const session of sessions) {
      const result = await scheduleAiSessionOnDate(dateKey, session, admin, userId);
      if ("error" in result) {
        return { error: result.error };
      }
      planIds.push(result.planId);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    return { planIds };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to add training day"),
    };
  }
}

export async function generateAiNutritionPlanAction(
  preferences?: string
): Promise<{ plan: AiGeneratedNutritionPlan } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const plan = await generateNutritionPlanFromProfile(access.profile, preferences);
    return { plan };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to generate nutrition plan"),
    };
  }
}

export async function applyAiHiitPlanAction(
  plan: AiGeneratedHiitPlan
): Promise<{ planId: string } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  const limit = await checkAiPlanApplyAllowed(access.profile, "workout");
  if (!limit.allowed) return { error: limit.error };

  if (!plan.config?.exercises?.length) return { error: "No HIIT exercises to apply" };

  const saved = await savePersonalHiitPlan({
    title: plan.title,
    description: plan.description || "AI Coach · HIIT",
    config: plan.config,
    assign: true,
  });
  if (saved.error || !saved.data) {
    return { error: saved.error ?? "Could not create HIIT workout" };
  }

  await consumeAiPlanApply(access.profile, "workout");

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/ai/plans/workout");
  revalidatePath("/dashboard");
  return { planId: saved.data.id };
}

export async function applyAiWorkoutPlanAction(
  plan: AiWorkoutPlanResult
): Promise<{ planId: string } | { error: string }> {
  if (isAiHiitPlan(plan)) {
    return applyAiHiitPlanAction(plan);
  }

  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  const limit = await checkAiPlanApplyAllowed(access.profile, "workout");
  if (!limit.allowed) return { error: limit.error };

  if (!plan.days?.length) return { error: "No workout days to apply" };

  // Multi-day splits belong under Plans (week template + single-day workouts).
  if (plan.days.length >= 2) {
    return applyMultiDayStrengthAsWeekPlan(plan);
  }

  const planFp = fingerprintStrengthPlan(
    plan.title,
    plan.days.map((d) => ({ title: d.title, exercises: d.exercises }))
  );
  if (planFp) {
    const createAccess = await ensureManualPlanCreation();
    if (!("error" in createAccess)) {
      const { admin, userId } = createAccess;
      const { data: candidates } = await admin
        .from("workout_plans")
        .select("id")
        .eq("created_by", userId)
        .eq("is_personal", true)
        .eq("kind", "strength")
        .order("created_at", { ascending: false })
        .limit(40);
      for (const row of candidates ?? []) {
        const details = await getPersonalWorkoutPlanWithDetails(row.id as string);
        if (!details.plan || details.days.length !== plan.days.length) continue;
        const existingFp = fingerprintStrengthPlan(
          String(details.plan.title ?? ""),
          details.days.map((d) => ({
            title: String(d.title ?? ""),
            exercises: (
              (d.exercises as {
                name: string;
                sets: number | null;
                reps: string | null;
                rest_seconds: number | null;
                order_index?: number | null;
              }[]) ?? []
            )
              .slice()
              .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
          }))
        );
        if (existingFp && existingFp === planFp) {
          return { planId: row.id as string };
        }
      }
    }
  }

  const created = await createPersonalWorkoutPlan(
    plan.title,
    plan.description || `AI Coach · ${plan.days_per_week} days/week`
  );
  if (created.error || !created.data) {
    return { error: created.error ?? "Could not create workout plan" };
  }

  const planId = created.data.id;

  for (let i = 0; i < plan.days.length; i++) {
    const day = plan.days[i];
    const result = await saveWorkoutDay(planId, i, day.title, day.exercises);
    if (result.error) return { error: result.error };
  }

  const assigned = await assignPersonalWorkoutPlan(planId);
  if (assigned.error) return { error: assigned.error };

  await consumeAiPlanApply(access.profile, "workout");

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/ai/plans/workout");
  revalidatePath("/dashboard");
  return { planId };
}

/** Save a multi-day split as single-day Workouts + a Plans week template. */
async function applyMultiDayStrengthAsWeekPlan(
  plan: AiGeneratedWorkoutPlan
): Promise<{ planId: string } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  const weekdays = defaultWeekdaysForCount(plan.days.length);
  const dayRefs: {
    weekday: number;
    mainPlanId: string;
    mainDayId: string;
    focus: string;
  }[] = [];

  for (let i = 0; i < plan.days.length; i++) {
    const day = plan.days[i]!;
    const title = day.title?.trim() || `Day ${i + 1}`;
    const created = await createPersonalWorkoutPlan(
      title,
      plan.description?.trim() || `Part of ${plan.title} · AI Coach`
    );
    if (created.error || !created.data) {
      return { error: created.error ?? `Could not create workout for ${title}` };
    }
    const dayPlanId = created.data.id as string;
    const saved = await saveWorkoutDay(dayPlanId, 0, title, day.exercises);
    if (saved.error) return { error: saved.error };

    const details = await getPersonalWorkoutPlanWithDetails(dayPlanId);
    const dayId = details.days[0]?.id;
    if (!dayId) return { error: `Missing day after saving ${title}` };

    dayRefs.push({
      weekday: weekdays[i] ?? weekdays[weekdays.length - 1] ?? 1,
      mainPlanId: dayPlanId,
      mainDayId: dayId as string,
      focus: title,
    });
  }

  const week = await createPersonalWeekPlan({
    title: plan.title,
    description:
      plan.description?.trim() ||
      `AI Coach · ${plan.days.length} training days`,
    days: dayRefs,
  });
  if ("error" in week || !("id" in week) || !week.id) {
    return {
      error:
        ("error" in week ? week.error : null) ?? "Could not create week plan",
    };
  }

  await consumeAiPlanApply(access.profile, "workout");

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/plans");
  revalidatePath("/dashboard/ai/plans/workout");
  revalidatePath("/dashboard");
  return { planId: week.id };
}

export async function applyAiNutritionPlanAction(
  plan: AiGeneratedNutritionPlan
): Promise<{ planId: string } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  const limit = await checkAiPlanApplyAllowed(access.profile, "nutrition");
  if (!limit.allowed) return { error: limit.error };

  if (!plan.meals?.length) return { error: "No meals to apply" };

  const created = await createPersonalNutritionPlan(
    plan.title,
    plan.description || "AI Coach day menu",
    {
      target_calories: plan.daily_targets.calories,
      target_protein: plan.daily_targets.protein,
      target_carbs: plan.daily_targets.carbs,
      target_fat: plan.daily_targets.fat,
    }
  );
  if (created.error || !created.data) {
    return { error: created.error ?? "Could not create nutrition plan" };
  }

  const planId = created.data.id;

  for (const meal of plan.meals) {
    const result = await addMealToDayMenuSlot(planId, meal.slot as MealSlot, {
      meal_type:
        meal.slot === "breakfast"
          ? "breakfast"
          : meal.slot === "lunch"
            ? "lunch"
            : meal.slot === "dinner"
              ? "dinner"
              : "snack",
      name: meal.name,
      description: meal.description ?? "",
      macros: {
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      },
      ingredients: meal.ingredients ?? [],
    });
    if (result.error) return { error: result.error };
  }

  const groceryItems = normalizeGroceryList(plan.grocery_list);
  const resolvedGrocery =
    groceryItems.length > 0
      ? groceryItems
      : buildWeeklyGroceryListFromMeals(
          plan.meals.map((meal) => ({ foods: meal.ingredients ?? [] }))
        );
  if (resolvedGrocery.length > 0) {
    const grocerySave = await savePlanGroceryList(planId, resolvedGrocery);
    if ("error" in grocerySave) return { error: grocerySave.error };
  }

  const assigned = await assignPersonalNutritionPlan(planId);
  if (assigned.error) return { error: assigned.error };

  const targets = await updateNutritionTargets(access.profile.id, plan.daily_targets, {
    personalPlanId: planId,
  });
  if (targets.error) return { error: targets.error };

  await consumeAiPlanApply(access.profile, "nutrition");

  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard/ai/plans/nutrition");
  revalidatePath("/dashboard");
  return { planId };
}

/** Apply a plan preview from AI coach chat (same as plan builder apply).
 * When the preview includes schedule intent and `scheduleToCalendar` is not
 * false, also places it on the calendar. Pass `scheduleToCalendar: false` to
 * save to Plans/Workouts only.
 */
export async function applyChatPlanPreviewAction(
  type: "workout" | "nutrition" | "weekly_full",
  plan: AiWorkoutPlanResult | AiGeneratedNutritionPlan | AiWeeklyFullProgram,
  schedule?: { weeks: number; weekdays: number[]; startDate?: string } | null,
  options?: { scheduleToCalendar?: boolean }
): Promise<
  | { planId: string; editPath: string; scheduledCount: number; weeks: number }
  | { error: string }
> {
  const scheduleToCalendar = options?.scheduleToCalendar !== false;

  if (type === "weekly_full") {
    const program = plan as AiWeeklyFullProgram;
    const weeks = schedule?.weeks ?? 4;
    const weekdays =
      schedule?.weekdays && schedule.weekdays.length > 0
        ? schedule.weekdays
        : defaultWeekdaysForCount(program.days.length);
    const result = await applyWeeklyFullProgramAction(
      program,
      {
        weeks,
        weekdays,
        startDate: schedule?.startDate,
      },
      { scheduleToCalendar }
    );
    if ("error" in result) return result;
    return {
      planId: result.planId,
      editPath: result.editPath,
      scheduledCount: result.scheduledCount,
      weeks,
    };
  }

  if (type === "workout") {
    const workoutPlan = plan as AiWorkoutPlanResult;
    const result = await applyAiWorkoutPlanAction(workoutPlan);
    if ("error" in result) return result;

    const isMultiDay =
      !isAiHiitPlan(workoutPlan) && workoutPlan.days.length >= 2;

    let scheduledCount = 0;
    const weeks = schedule?.weeks ?? 4;
    if (scheduleToCalendar && schedule && !isMultiDay) {
      const scheduled = await scheduleWorkoutPlanDays({
        planId: result.planId,
        weeks,
        weekdays: schedule.weekdays ?? [],
        startDate: schedule.startDate,
      });
      if ("error" in scheduled && scheduled.error) {
        return {
          error: `Plan saved, but scheduling failed: ${scheduled.error}`,
        };
      }
      scheduledCount = "count" in scheduled ? (scheduled.count as number) : 0;
    }

    return {
      planId: result.planId,
      editPath: isMultiDay
        ? "/dashboard/workout/plans"
        : `/dashboard/workout/${result.planId}/edit`,
      scheduledCount,
      weeks,
    };
  }

  const result = await applyAiNutritionPlanAction(plan as AiGeneratedNutritionPlan);
  if ("error" in result) return result;

  let scheduledCount = 0;
  const weeks = schedule?.weeks ?? 4;
  if (scheduleToCalendar && schedule) {
    const startDate =
      schedule.startDate?.trim() || new Date().toISOString().split("T")[0];
    const weekdays =
      schedule.weekdays.length > 0 ? schedule.weekdays : [0, 1, 2, 3, 4, 5, 6];
    const scheduled = await scheduleNutritionSeries({
      startDate,
      weekdays,
      weeks: Math.min(52, Math.max(1, Math.round(weeks))),
      planId: result.planId,
    });
    if (scheduled?.error) {
      return { error: `Plan saved, but scheduling failed: ${scheduled.error}` };
    }
    scheduledCount = "count" in scheduled ? (scheduled.count as number) : 0;
  }

  return {
    planId: result.planId,
    editPath: `/dashboard/nutrition/${result.planId}/edit`,
    scheduledCount,
    weeks,
  };
}

function defaultWeekdaysForCount(dayCount: number): number[] {
  if (dayCount >= 5) return [1, 2, 3, 4, 5];
  if (dayCount >= 4) return [1, 2, 4, 5];
  if (dayCount === 3) return [1, 3, 5];
  if (dayCount === 2) return [1, 4];
  return [1];
}

/**
 * Saves mains as a multi-day program (Plans tab), and optionally schedules
 * warm-up + main + stretch (or main only) on each weekday for N weeks.
 */
export async function applyWeeklyFullProgramAction(
  program: AiWeeklyFullProgram,
  schedule: { weeks: number; weekdays: number[]; startDate?: string },
  options?: { scheduleToCalendar?: boolean }
): Promise<
  | { planId: string; editPath: string; scheduledCount: number }
  | { error: string }
> {
  const scheduleToCalendar = options?.scheduleToCalendar !== false;
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  const limit = await checkAiPlanApplyAllowed(access.profile, "workout");
  if (!limit.allowed) return { error: limit.error };

  if (!program.days?.length) return { error: "No training days to apply" };

  const createAccess = await ensureManualPlanCreation();
  if ("error" in createAccess) return { error: createAccess.error };
  const { admin, userId } = createAccess;

  const weeks = Math.min(52, Math.max(1, Math.round(schedule.weeks) || 4));
  const weekdays =
    schedule.weekdays.length > 0
      ? schedule.weekdays
      : defaultWeekdaysForCount(program.days.length);
  const startDate =
    schedule.startDate?.trim() || new Date().toISOString().split("T")[0];
  const anchor = new Date(startDate + "T12:00:00");

  // Deduplicate weekdays so we never place two warm-ups on the same calendar day.
  const uniqueWeekdays = [...new Set(weekdays)];
  const slotCount = Math.min(program.days.length, uniqueWeekdays.length);

  if (scheduleToCalendar) {
    const targetDates = new Set<string>();
    for (let i = 0; i < slotCount; i++) {
      const dates = generateRecurringScheduleDates(
        anchor,
        [uniqueWeekdays[i]!],
        weeks
      );
      for (const d of dates) targetDates.add(d);
    }

    // Clear prior warm-up / main / stretch on those dates so re-Apply after a
    // partial failure (or a previous program) doesn't hit "already has a warm-up".
    await clearScheduledWorkoutKindsOnDates(
      admin,
      userId,
      [...targetDates],
      program.includeExtras
        ? ["warmup", "stretch", "strength", "hiit"]
        : ["strength", "hiit"]
    );
  }

  // Create each unique day template once (single-day Workouts), then reuse
  // across weeks. The week template below is what appears under Plans.
  type SlotRef = { planId: string; dayId: string };
  type PreparedSlot = {
    warmup?: SlotRef;
    main: SlotRef;
    stretch?: SlotRef;
  };

  const prepared: PreparedSlot[] = [];

  for (let i = 0; i < slotCount; i++) {
    const dayProgram = program.days[i]!;
    const slot: PreparedSlot = {
      main: { planId: "", dayId: "" },
    };

    if (program.includeExtras) {
      const warmup = await savePersonalHiitPlan({
        title: dayProgram.warmup.title,
        description:
          dayProgram.warmup.description?.trim() ||
          "AI Coach · warm-up · weekly template",
        config: dayProgram.warmup.config,
        assign: false,
        kind: "warmup",
      });
      if (warmup.error || !warmup.data) {
        return { error: warmup.error ?? "Could not save warm-up template" };
      }
      slot.warmup = { planId: warmup.data.id, dayId: warmup.data.dayId };
    }

    if (dayProgram.main.kind === "hiit") {
      const hiit = await savePersonalHiitPlan({
        title: dayProgram.main.plan.title,
        description:
          dayProgram.main.plan.description?.trim() ||
          "AI Coach · HIIT · weekly template",
        config: dayProgram.main.plan.config,
        assign: true,
        kind: "hiit",
      });
      if (hiit.error || !hiit.data) {
        return { error: hiit.error ?? "Could not save HIIT template" };
      }
      slot.main = { planId: hiit.data.id, dayId: hiit.data.dayId };
    }

    if (program.includeExtras) {
      const stretch = await savePersonalHiitPlan({
        title: dayProgram.stretch.title,
        description:
          dayProgram.stretch.description?.trim() ||
          "AI Coach · stretching · weekly template",
        config: dayProgram.stretch.config,
        assign: false,
        kind: "stretch",
      });
      if (stretch.error || !stretch.data) {
        return { error: stretch.error ?? "Could not save stretch template" };
      }
      slot.stretch = { planId: stretch.data.id, dayId: stretch.data.dayId };
    }

    prepared.push(slot);
  }

  // Create single-day strength mains for each training day.
  for (let i = 0; i < slotCount; i++) {
    const dayProgram = program.days[i]!;
    if (dayProgram.main.kind !== "strength") continue;
    if (prepared[i]!.main.planId) continue;

    const workout = dayProgram.main.workout;
    const title = workout.title?.trim() || dayProgram.focus || "AI Workout";
    const strengthFp = fingerprintStrengthExercises(workout.exercises);
    let found: SlotRef | null = null;

    if (strengthFp) {
      const { data: candidates } = await admin
        .from("workout_plans")
        .select("id")
        .eq("created_by", userId)
        .eq("is_personal", true)
        .eq("kind", "strength")
        .order("created_at", { ascending: false })
        .limit(60);
      for (const row of candidates ?? []) {
        const { data: days } = await admin
          .from("workout_days")
          .select(
            "id, exercises(name, sets, reps, rest_seconds, order_index)"
          )
          .eq("plan_id", row.id)
          .order("day_index");
        if (!days || days.length !== 1) continue;
        const day = days[0]!;
        const exercises = (
          (day.exercises as {
            name: string;
            sets: number | null;
            reps: string | null;
            rest_seconds: number | null;
            order_index: number | null;
          }[]) ?? []
        )
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        if (fingerprintStrengthExercises(exercises) === strengthFp) {
          found = { planId: row.id as string, dayId: day.id as string };
          break;
        }
      }
    }

    if (!found) {
      const { data: plan, error: planError } = await admin
        .from("workout_plans")
        .insert({
          title,
          description:
            workout.description?.trim() || "AI Coach · weekly template",
          created_by: userId,
          is_personal: true,
          folder_id: null,
          kind: "strength",
        })
        .select("id")
        .single();
      if (planError || !plan) {
        return { error: planError?.message ?? "Could not create main workout" };
      }
      const { data: day, error: dayError } = await admin
        .from("workout_days")
        .insert({ plan_id: plan.id, day_index: 0, title })
        .select("id")
        .single();
      if (dayError || !day) {
        await admin.from("workout_plans").delete().eq("id", plan.id);
        return { error: dayError?.message ?? "Could not save main day" };
      }
      const enriched = workout.exercises.map((ex) =>
        enrichExerciseWithGif({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          image_url: ex.image_url,
          video_url: ex.video_url,
        })
      );
      const { error: exError } = await admin.from("exercises").insert(
        enriched.map((ex, idx) => ({
          day_id: day.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes ?? null,
          image_url: ex.image_url ?? null,
          video_url: ex.video_url ?? null,
          order_index: idx,
        }))
      );
      if (exError) {
        await admin.from("workout_plans").delete().eq("id", plan.id);
        return { error: exError.message };
      }
      found = { planId: plan.id as string, dayId: day.id as string };
    }

    prepared[i]!.main = found;
  }

  let scheduledCount = 0;

  if (scheduleToCalendar) {
    for (let i = 0; i < slotCount; i++) {
      const slot = prepared[i]!;
      const weekday = uniqueWeekdays[i]!;
      const dates = generateRecurringScheduleDates(anchor, [weekday], weeks);

      for (const dateKey of dates) {
        const refs: SlotRef[] = [];
        if (slot.warmup) refs.push(slot.warmup);
        refs.push(slot.main);
        if (slot.stretch) refs.push(slot.stretch);

        for (const ref of refs) {
          if (!ref.planId || !ref.dayId) {
            return { error: "Missing workout template while scheduling" };
          }
          const scheduled = await addWorkoutToDay(
            dateKey,
            ref.planId,
            ref.dayId
          );
          if (scheduled.error) {
            return {
              error: `Scheduled partially, then failed on ${dateKey}: ${scheduled.error}`,
            };
          }
          scheduledCount += 1;
        }
      }
    }
  }

  // Persist a reusable week template (Plans tab) — schedule again by weeks later.
  const weekDays = prepared.flatMap((slot, i) => {
    if (!slot.main.planId || !slot.main.dayId) return [];
    const dayProgram = program.days[i]!;
    return [
      {
        focus: dayProgram.focus || "Training",
        weekday: uniqueWeekdays[i]!,
        mainPlanId: slot.main.planId,
        mainDayId: slot.main.dayId,
        warmupPlanId: slot.warmup?.planId ?? null,
        stretchPlanId: slot.stretch?.planId ?? null,
      },
    ];
  });

  let weekPlanId: string | null = null;
  if (weekDays.length > 0) {
    const week_config = {
      includeExtras: program.includeExtras !== false,
      days: weekDays,
    };
    const { data: existingWeek } = await admin
      .from("workout_plans")
      .select("id")
      .eq("created_by", userId)
      .eq("is_personal", true)
      .eq("kind", "week")
      .eq("title", program.title)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingWeek?.id) {
      const { error: weekUpdateError } = await admin
        .from("workout_plans")
        .update({
          description:
            program.description ||
            `Full week · ${weekDays.length} training day${weekDays.length === 1 ? "" : "s"}`,
          week_config,
        })
        .eq("id", existingWeek.id)
        .eq("created_by", userId);
      if (!weekUpdateError) weekPlanId = existingWeek.id as string;
    } else {
      const { data: weekPlan, error: weekInsertError } = await admin
        .from("workout_plans")
        .insert({
          title: program.title,
          description:
            program.description ||
            `Full week · ${weekDays.length} training day${weekDays.length === 1 ? "" : "s"}`,
          created_by: userId,
          is_personal: true,
          folder_id: null,
          kind: "week",
          week_config,
        })
        .select("id")
        .single();
      if (!weekInsertError && weekPlan?.id) {
        weekPlanId = weekPlan.id as string;
      }
    }
  }

  await consumeAiPlanApply(access.profile, "workout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/plans");
  revalidatePath("/dashboard/ai/plans/workout");

  return {
    planId: weekPlanId ?? prepared[0]?.main.planId ?? "calendar",
    editPath: weekPlanId
      ? "/dashboard/workout/plans"
      : "/dashboard/workout",
    scheduledCount,
  };
}

async function clearScheduledWorkoutKindsOnDates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  dateKeys: string[],
  kinds: string[]
) {
  if (dateKeys.length === 0 || kinds.length === 0) return;

  const { data: rows } = await admin
    .from("scheduled_workouts")
    .select("id, scheduled_date, workout_plans(kind)")
    .eq("client_id", userId)
    .in("scheduled_date", dateKeys);

  const ids = (rows ?? [])
    .filter(
      (row: {
        id: string;
        workout_plans?: { kind?: string } | { kind?: string }[] | null;
      }) => {
        const kind = Array.isArray(row.workout_plans)
          ? row.workout_plans[0]?.kind
          : row.workout_plans?.kind;
        return kind != null && kinds.includes(kind);
      }
    )
    .map((row: { id: string }) => row.id);

  if (ids.length === 0) return;

  await admin.from("scheduled_workouts").delete().in("id", ids);
}
