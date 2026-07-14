import {
  DAILY_MICRO_TARGETS,
  estimateMealMicros,
} from "@/lib/nutrition-day-utils";
import type { MealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";

export type OverageNutrient =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "sodium"
  | "sugar";

export type MacroOverageInsight = {
  nutrient: OverageNutrient;
  culpritMealId: string | null;
  culpritMealName: string;
  amountFromMeal: number;
  problemFoods: string[];
  explanation: string;
  avoidNextTime: string;
};

export function mealMacroValue(
  meal: DailyMealLog,
  nutrient: OverageNutrient
): number {
  if (nutrient === "sodium" || nutrient === "sugar") {
    const micros = estimateMealMicros(
      {
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      },
      1
    );
    return micros[nutrient];
  }
  return meal[nutrient] ?? 0;
}

export function nutrientUnit(nutrient: OverageNutrient): string {
  if (nutrient === "calories") return "kcal";
  if (nutrient === "sodium") return "mg";
  return "g";
}

export function nutrientLabel(nutrient: OverageNutrient): string {
  switch (nutrient) {
    case "calories":
      return "calories";
    case "protein":
      return "protein";
    case "carbs":
      return "carbs";
    case "fat":
      return "fat";
    case "sodium":
      return "sodium";
    case "sugar":
      return "sugar";
  }
}

export function mealFoodNames(meal: DailyMealLog): string[] {
  return (meal.foods ?? [])
    .map((food) => food.name?.trim())
    .filter((name): name is string => Boolean(name));
}

/** Nutrients currently above their day target (macros + optional micros). */
export function listOverTargetNutrients(
  current: MealMacros,
  targets: MealMacros,
  micros?: { sodium?: number; sugar?: number } | null
): OverageNutrient[] {
  const over: OverageNutrient[] = [];
  for (const key of ["calories", "protein", "carbs", "fat"] as const) {
    if (targets[key] > 0 && current[key] > targets[key]) {
      over.push(key);
    }
  }
  if (micros?.sodium != null && micros.sodium > DAILY_MICRO_TARGETS.sodium) {
    over.push("sodium");
  }
  if (micros?.sugar != null && micros.sugar > DAILY_MICRO_TARGETS.sugar) {
    over.push("sugar");
  }
  return over;
}

/** Pick the logged meal that contributes the most to the overshot nutrient. */
export function fallbackMacroOverageInsight(
  meals: DailyMealLog[],
  nutrient: OverageNutrient,
  targets: MealMacros
): MacroOverageInsight {
  if (meals.length === 0) {
    return {
      nutrient,
      culpritMealId: null,
      culpritMealName: "No meals logged",
      amountFromMeal: 0,
      problemFoods: [],
      explanation:
        "Nothing is logged yet, so the overshoot is coming from missing or incomplete logging — not a specific meal.",
      avoidNextTime:
        "Log meals as you eat them so you can spot portion and add-on problems earlier.",
    };
  }

  const ranked = [...meals].sort(
    (a, b) => mealMacroValue(b, nutrient) - mealMacroValue(a, nutrient)
  );
  const top = ranked[0]!;
  const amount = Math.round(mealMacroValue(top, nutrient));
  const unit = nutrientUnit(nutrient);
  const label = nutrientLabel(nutrient);
  const target =
    nutrient === "sodium"
      ? DAILY_MICRO_TARGETS.sodium
      : nutrient === "sugar"
        ? DAILY_MICRO_TARGETS.sugar
        : targets[nutrient];
  const foods = mealFoodNames(top);

  return {
    nutrient,
    culpritMealId: top.id,
    culpritMealName: top.name,
    amountFromMeal: amount,
    problemFoods: foods.slice(0, 5),
    explanation: foods.length
      ? `"${top.name}" is your biggest ${label} hit today (~${amount}${unit} of a ${Math.round(target)}${unit} target). Main foods: ${foods.slice(0, 4).join(", ")}.`
      : `"${top.name}" is your biggest ${label} hit today (~${amount}${unit} vs a ${Math.round(target)}${unit} daily target).`,
    avoidNextTime:
      nutrient === "fat"
        ? "Next time: smaller oil/sauce/cheese portions, leaner cooking methods, and watch creamy sides."
        : nutrient === "sodium"
          ? "Next time: skip salty sauces, processed meats, and packaged snacks — season after tasting."
          : nutrient === "calories"
            ? "Next time: tighten portions of calorie-dense sides, drinks, and second helpings."
            : nutrient === "carbs" || nutrient === "sugar"
              ? "Next time: smaller starch/sweet portions and pair carbs with protein + vegetables."
              : "Next time: rebalance portions earlier in the day so one meal doesn't pile on late.",
  };
}

export function buildLocalDayOverageInsights({
  meals,
  current,
  targets,
  micros,
}: {
  meals: DailyMealLog[];
  current: MealMacros;
  targets: MealMacros;
  micros?: { sodium?: number; sugar?: number } | null;
}): MacroOverageInsight[] {
  return listOverTargetNutrients(current, targets, micros).map((nutrient) =>
    fallbackMacroOverageInsight(meals, nutrient, targets)
  );
}
