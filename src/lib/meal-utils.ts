import type { MealType } from "@/lib/types";

export interface MealIngredient {
  name: string;
  amount?: string;
}

export interface MealMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_MEAL_MACROS: MealMacros = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export interface MealFormData {
  meal_type: MealType;
  name: string;
  description: string;
  macros: MealMacros;
  ingredients: MealIngredient[];
}

export function normalizeMealMacros(meal: {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): MealMacros {
  return {
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
  };
}

export function formatMealMacrosSummary(macros: MealMacros): string {
  const parts = [
    macros.calories > 0 ? `${macros.calories} cal` : null,
    macros.protein > 0 ? `${macros.protein}g protein` : null,
    macros.carbs > 0 ? `${macros.carbs}g carbs` : null,
    macros.fat > 0 ? `${macros.fat}g fat` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function sumMealMacros(
  meals: Array<{
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  }>
): MealMacros {
  return meals.reduce<MealMacros>(
    (totals, meal) => {
      const macros = normalizeMealMacros(meal);
      return {
        calories: totals.calories + macros.calories,
        protein: totals.protein + macros.protein,
        carbs: totals.carbs + macros.carbs,
        fat: totals.fat + macros.fat,
      };
    },
    { ...DEFAULT_MEAL_MACROS }
  );
}

export function emptyMealForm(mealType: MealType = "breakfast"): MealFormData {
  return {
    meal_type: mealType,
    name: "",
    description: "",
    macros: { ...DEFAULT_MEAL_MACROS },
    ingredients: [{ name: "", amount: "" }],
  };
}

export function mealFormFromMeal(meal: {
  meal_type: MealType;
  name: string;
  description?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  foods?: { name: string; amount?: string }[];
}): MealFormData {
  const ingredients = (meal.foods ?? []).map((f) => ({
    name: f.name,
    amount: f.amount ?? "",
  }));
  return {
    meal_type: meal.meal_type,
    name: meal.name,
    description: meal.description ?? "",
    macros: normalizeMealMacros(meal),
    ingredients: ingredients.length > 0 ? ingredients : [{ name: "", amount: "" }],
  };
}

export function mealPayloadFromForm(data: MealFormData) {
  return {
    meal_type: data.meal_type,
    name: data.name.trim(),
    description: data.description.trim() || null,
    calories: data.macros.calories,
    protein: data.macros.protein,
    carbs: data.macros.carbs,
    fat: data.macros.fat,
    foods: data.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), amount: i.amount?.trim() || undefined })),
  };
}
