import {
  getClientNutritionAssignment,
  getClientWorkoutAssignment,
} from "@/lib/actions/plans";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import { generateWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
} from "@/lib/ai/plan-builder-types";
import type { Profile } from "@/lib/types";

type WorkoutDayRow = {
  day_index: number;
  title: string;
  exercises?: {
    order_index: number;
    name: string;
    sets?: number | null;
    reps?: string | null;
    rest_seconds?: number | null;
    notes?: string | null;
  }[];
};

type NutritionMealRow = {
  order_index: number;
  slot?: string | null;
  meal_type?: string | null;
  name: string;
  description?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  foods?: unknown;
};

function assignmentWorkoutToAiPlan(assignment: {
  workout_plans?: {
    title: string;
    description?: string | null;
    workout_days?: WorkoutDayRow[];
  } | null;
} | null): AiGeneratedWorkoutPlan | null {
  const plan = assignment?.workout_plans;
  if (!plan) return null;

  const days = (plan.workout_days ?? [])
    .sort((a, b) => a.day_index - b.day_index)
    .map((day) => ({
      title: day.title,
      exercises: (day.exercises ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => ({
          name: ex.name,
          sets: ex.sets ?? 3,
          reps: String(ex.reps ?? "10"),
          rest_seconds: ex.rest_seconds ?? 60,
          notes: ex.notes ?? undefined,
        })),
    }))
    .filter((day) => day.exercises.length > 0);

  if (days.length === 0) return null;

  return {
    title: plan.title,
    description: plan.description ?? "",
    days_per_week: days.length,
    days,
    coach_notes: [],
  };
}

function assignmentNutritionToAiPlan(assignment: {
  nutrition_plans?: {
    title: string;
    description?: string | null;
    target_calories?: number | null;
    target_protein?: number | null;
    target_carbs?: number | null;
    target_fat?: number | null;
    meals?: NutritionMealRow[];
  } | null;
} | null): AiGeneratedNutritionPlan | null {
  const plan = assignment?.nutrition_plans;
  if (!plan) return null;

  const meals = (plan.meals ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((meal) => ({
      slot: (meal.slot ?? meal.meal_type ?? "lunch") as AiGeneratedNutritionPlan["meals"][number]["slot"],
      name: meal.name,
      description: meal.description ?? undefined,
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      ingredients: Array.isArray(meal.foods)
        ? (meal.foods as { name?: string; amount?: string }[])
            .filter((f) => f?.name)
            .map((f) => ({ name: f.name!, amount: f.amount }))
        : undefined,
    }));

  if (meals.length === 0) return null;

  return {
    title: plan.title,
    description: plan.description ?? "",
    daily_targets: {
      calories: plan.target_calories ?? 0,
      protein: plan.target_protein ?? 0,
      carbs: plan.target_carbs ?? 0,
      fat: plan.target_fat ?? 0,
    },
    meals,
    coach_notes: [],
  };
}

export async function loadActiveWorkoutPlan(clientId: string) {
  const assignment = await getClientWorkoutAssignment(clientId);
  return assignmentWorkoutToAiPlan(assignment);
}

export async function loadActiveNutritionPlan(clientId: string) {
  const assignment = await getClientNutritionAssignment(clientId);
  return assignmentNutritionToAiPlan(assignment);
}

export async function summarizeActivePlans(clientId: string): Promise<string> {
  const [workout, nutrition] = await Promise.all([
    loadActiveWorkoutPlan(clientId),
    loadActiveNutritionPlan(clientId),
  ]);

  const lines: string[] = [];

  if (workout) {
    lines.push(
      `Workout plan: "${workout.title}" — ${workout.days.length} day(s): ${workout.days.map((d) => d.title).join(", ")}`
    );
  } else {
    lines.push("Workout plan: none assigned");
  }

  if (nutrition) {
    lines.push(
      `Nutrition plan: "${nutrition.title}" — ${nutrition.daily_targets.calories} cal, P${nutrition.daily_targets.protein} C${nutrition.daily_targets.carbs} F${nutrition.daily_targets.fat}; meals: ${nutrition.meals.map((m) => `${m.slot}: ${m.name}`).join(", ")}`
    );
  } else {
    lines.push("Nutrition plan: none assigned");
  }

  return lines.join("\n");
}

export async function generateWorkoutPlanForChat(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedWorkoutPlan> {
  return generateWorkoutPlanFromProfile(profile, preferences);
}

export async function generateNutritionPlanForChat(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedNutritionPlan> {
  return generateNutritionPlanFromProfile(profile, preferences);
}

export async function editWorkoutPlanForChat(
  profile: Profile,
  instructions: string
): Promise<AiGeneratedWorkoutPlan> {
  const current = await loadActiveWorkoutPlan(profile.id);
  const context = current
    ? `CURRENT WORKOUT PLAN (modify this — keep what still works unless asked to remove):\n${JSON.stringify(current, null, 2)}\n\n`
    : "The client has no active workout plan yet — create one based on the edit request.\n\n";

  return generateWorkoutPlanFromProfile(
    profile,
    `${context}CHANGES REQUESTED:\n${instructions.trim()}\n\nReturn a complete updated workout plan.`
  );
}

export async function editNutritionPlanForChat(
  profile: Profile,
  instructions: string
): Promise<AiGeneratedNutritionPlan> {
  const current = await loadActiveNutritionPlan(profile.id);
  const context = current
    ? `CURRENT NUTRITION PLAN (modify this — keep what still works unless asked to remove):\n${JSON.stringify(current, null, 2)}\n\n`
    : "The client has no active nutrition plan yet — create one based on the edit request.\n\n";

  return generateNutritionPlanFromProfile(
    profile,
    `${context}CHANGES REQUESTED:\n${instructions.trim()}\n\nReturn a complete updated day menu with daily_targets and all meal slots.`
  );
}
