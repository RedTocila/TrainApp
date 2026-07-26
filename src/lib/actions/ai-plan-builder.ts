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
import { createPersonalWorkoutPlan, assignPersonalWorkoutPlan, addWorkoutToDay, getPersonalWorkoutPlanWithDetails } from "@/lib/actions/user-workouts";
import { savePersonalHiitPlan } from "@/lib/actions/user-hiit";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import type { WorkoutPlanKind } from "@/lib/hiit";
import { isMainWorkoutKind } from "@/lib/hiit";
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
  userId: string
): Promise<{ planId: string } | { error: string }> {
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
      assign: true,
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

    const { days } = await getPersonalWorkoutPlanWithDetails(saved.data.id);
    const dayId = days[0]?.id;
    if (!dayId) return { error: "Could not save session day" };

    const scheduled = await addWorkoutToDay(dateKey, saved.data.id, dayId);
    if (scheduled.error) return { error: scheduled.error };
    return { planId: saved.data.id };
  }

  const workout = session.workout;
  if (!workout.exercises?.length) return { error: "No exercises to add" };

  const title = workout.title?.trim() || "AI Workout";
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

/** Apply a plan preview from AI coach chat (same as plan builder apply). */
export async function applyChatPlanPreviewAction(
  type: "workout" | "nutrition",
  plan: AiWorkoutPlanResult | AiGeneratedNutritionPlan
): Promise<{ planId: string; editPath: string } | { error: string }> {
  if (type === "workout") {
    const result = await applyAiWorkoutPlanAction(plan as AiWorkoutPlanResult);
    if ("error" in result) return result;
    return { planId: result.planId, editPath: `/dashboard/workout/${result.planId}/edit` };
  }

  const result = await applyAiNutritionPlanAction(plan as AiGeneratedNutritionPlan);
  if ("error" in result) return result;
  return { planId: result.planId, editPath: `/dashboard/nutrition/${result.planId}/edit` };
}
