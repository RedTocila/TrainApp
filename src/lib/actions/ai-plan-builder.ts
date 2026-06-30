"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import {
  checkAiPlanApplyAllowed,
  consumeAiPlanApply,
} from "@/lib/actions/usage-limits";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { hasAiPlanBuilderAccess } from "@/lib/subscription-limits";
import { isAiConfigured } from "@/lib/ai/providers";
import { generateWorkoutDayFromProfile, generateWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
} from "@/lib/ai/plan-builder-types";
import { saveWorkoutDay } from "@/lib/actions/plans";
import { createPersonalWorkoutPlan, assignPersonalWorkoutPlan, addWorkoutToDay } from "@/lib/actions/user-workouts";
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
  preferences?: string
): Promise<{ plan: AiGeneratedWorkoutPlan } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const plan = await generateWorkoutPlanFromProfile(access.profile, preferences);
    return { plan };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to generate workout plan",
    };
  }
}

export async function generateAiWorkoutDayAction(
  prompt: string
): Promise<{ workout: AiGeneratedWorkoutDay } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  try {
    const workout = await generateWorkoutDayFromProfile(access.profile, prompt);
    return { workout };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to generate workout",
    };
  }
}

export async function applyAiWorkoutDayToDateAction(
  dateKey: string,
  workout: AiGeneratedWorkoutDay
): Promise<{ planId: string } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

  if (!workout.exercises?.length) return { error: "No exercises to add" };

  const created = await createPersonalWorkoutPlan(
    workout.title,
    workout.description || "AI Coach · one-off session"
  );
  if (created.error || !created.data) {
    return { error: created.error ?? "Could not create workout" };
  }

  const planId = created.data.id;
  const saved = await saveWorkoutDay(planId, 0, workout.title, workout.exercises);
  if (saved.error) return { error: saved.error };
  if (!saved.dayId) return { error: "Could not save workout day" };

  const scheduled = await addWorkoutToDay(dateKey, planId, saved.dayId);
  if (scheduled.error) return { error: scheduled.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { planId };
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
      error: error instanceof Error ? error.message : "Failed to generate nutrition plan",
    };
  }
}

export async function applyAiWorkoutPlanAction(
  plan: AiGeneratedWorkoutPlan
): Promise<{ planId: string } | { error: string }> {
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
  plan: AiGeneratedWorkoutPlan | AiGeneratedNutritionPlan
): Promise<{ planId: string; editPath: string } | { error: string }> {
  if (type === "workout") {
    const result = await applyAiWorkoutPlanAction(plan as AiGeneratedWorkoutPlan);
    if ("error" in result) return result;
    return { planId: result.planId, editPath: `/dashboard/workout/${result.planId}/edit` };
  }

  const result = await applyAiNutritionPlanAction(plan as AiGeneratedNutritionPlan);
  if ("error" in result) return result;
  return { planId: result.planId, editPath: `/dashboard/nutrition/${result.planId}/edit` };
}
