"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { hasAiAccess } from "@/lib/subscription";
import { isAiConfigured } from "@/lib/ai/providers";
import { generateWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
} from "@/lib/ai/plan-builder-types";
import { saveWorkoutDay } from "@/lib/actions/plans";
import { createPersonalWorkoutPlan, assignPersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import {
  createPersonalNutritionPlan,
  assignPersonalNutritionPlan,
  addMealToDayMenuSlot,
} from "@/lib/actions/user-nutrition";
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
  if (!hasAiAccess(profile)) {
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

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/ai/plans/workout");
  return { planId };
}

export async function applyAiNutritionPlanAction(
  plan: AiGeneratedNutritionPlan
): Promise<{ planId: string } | { error: string }> {
  const access = await requireAiPlanBuilder();
  if (!access.success) return { error: access.error };

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

  const assigned = await assignPersonalNutritionPlan(planId);
  if (assigned.error) return { error: assigned.error };

  const targets = await updateNutritionTargets(access.profile.id, plan.daily_targets, {
    personalPlanId: planId,
  });
  if (targets.error) return { error: targets.error };

  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard/ai/plans/nutrition");
  revalidatePath("/dashboard");
  return { planId };
}
