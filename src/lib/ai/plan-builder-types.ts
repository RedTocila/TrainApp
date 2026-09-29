import type { HiitConfig } from "@/lib/hiit";

export interface AiWorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
  image_url?: string;
  video_url?: string;
}

export interface AiWorkoutDay {
  title: string;
  exercises: AiWorkoutExercise[];
}

/** Traditional sets/reps weekly workout plan. */
export interface AiGeneratedWorkoutPlan {
  kind?: "strength";
  title: string;
  description: string;
  days_per_week: number;
  days: AiWorkoutDay[];
  coach_notes: string[];
}

/** Timed-interval HIIT session (matches manual HIIT builder / hiit_config). */
export interface AiGeneratedHiitPlan {
  kind: "hiit";
  title: string;
  description: string;
  config: HiitConfig;
  coach_notes: string[];
}

export type AiWorkoutPlanResult = AiGeneratedWorkoutPlan | AiGeneratedHiitPlan;

export function isAiHiitPlan(plan: AiWorkoutPlanResult): plan is AiGeneratedHiitPlan {
  return plan.kind === "hiit";
}

/** One-off session for a single calendar day. */
export interface AiGeneratedWorkoutDay {
  title: string;
  description: string;
  exercises: AiWorkoutExercise[];
  coach_notes: string[];
}

export interface AiNutritionIngredient {
  name: string;
  amount?: string;
  /** Food-catalog id, so recalculation and swaps work whatever the display language. */
  food?: string;
}

export interface AiNutritionMeal {
  slot: "breakfast" | "snack_1" | "lunch" | "snack_2" | "dinner";
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  /** "calculated" = summed from catalog foods; "estimated" = some foods had no reference data. */
  macro_source?: "calculated" | "estimated";
  ingredients?: AiNutritionIngredient[];
}

export interface AiNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** An extra daily menu rotated through the week (Day B, Day C…). */
export interface AiNutritionDayMenu {
  label: string;
  meals: AiNutritionMeal[];
  daily_totals?: AiNutritionTotals;
  nutrition_estimated?: boolean;
}

export interface AiGeneratedNutritionPlan {
  title: string;
  description: string;
  daily_targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: AiNutritionMeal[];
  coach_notes: string[];
  grocery_list?: { name: string; amount?: string; category?: string }[];
  /** Sum of the meals as actually written (always equals the meal values added up). */
  daily_totals?: AiNutritionTotals;
  /** True when any meal total is an estimate rather than a catalog calculation. */
  nutrition_estimated?: boolean;
  /** Label of the main menu when the plan rotates several (e.g. "Day A"). */
  day_label?: string;
  /** Further daily menus; `meals` is the first one. The grocery list covers all of them. */
  day_variants?: AiNutritionDayMenu[];
}
