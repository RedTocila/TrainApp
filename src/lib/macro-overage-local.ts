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
  /** Kept for AI payload compat; not shown as a ban-list in the UI. */
  problemFoods: string[];
  explanation: string;
  avoidNextTime: string;
};

export type OverageTipCopy = {
  noMealsLogged: string;
  noMealsTip: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  sodium: string;
  sugar: string;
  noMealsName?: string;
  nutrientShort?: Record<OverageNutrient, string>;
  explain?: (params: {
    meal: string;
    amount: number;
    unit: string;
    nutrient: string;
    share: number;
    target: number;
  }) => string;
};

const DEFAULT_OVERAGE_TIPS: OverageTipCopy = {
  noMealsLogged:
    "Nothing is logged yet — the overshoot is from missing data, not a meal.",
  noMealsTip: "Log meals as you eat so you can catch portions earlier.",
  calories: "Smaller sides and skip second helpings.",
  protein: "Spread protein more evenly across meals.",
  carbs: "Smaller starch and sweet portions next time.",
  fat: "Lighter sauce, oil, and cheese next time.",
  sodium: "Go easier on salty sauces and packaged add-ons.",
  sugar: "Smaller sweet portions next time.",
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

function tipForNutrient(
  nutrient: OverageNutrient,
  tips: OverageTipCopy
): string {
  return tips[nutrient];
}

/** Pick the logged meal that contributes the most to the overshot nutrient. */
export function fallbackMacroOverageInsight(
  meals: DailyMealLog[],
  nutrient: OverageNutrient,
  targets: MealMacros,
  tips: OverageTipCopy = DEFAULT_OVERAGE_TIPS
): MacroOverageInsight {
  if (meals.length === 0) {
    return {
      nutrient,
      culpritMealId: null,
      culpritMealName: tips.noMealsName ?? "No meals logged",
      amountFromMeal: 0,
      problemFoods: [],
      explanation: tips.noMealsLogged,
      avoidNextTime: tips.noMealsTip,
    };
  }

  const ranked = [...meals].sort(
    (a, b) => mealMacroValue(b, nutrient) - mealMacroValue(a, nutrient)
  );
  const top = ranked[0]!;
  const amount = Math.round(mealMacroValue(top, nutrient));
  const unit = nutrientUnit(nutrient);
  const label = tips.nutrientShort?.[nutrient] ?? nutrientLabel(nutrient);
  const target =
    nutrient === "sodium"
      ? DAILY_MICRO_TARGETS.sodium
      : nutrient === "sugar"
        ? DAILY_MICRO_TARGETS.sugar
        : targets[nutrient];
  const targetRounded = Math.round(target);
  const share =
    targetRounded > 0 ? Math.round((amount / targetRounded) * 100) : 0;
  const explainParams = {
    meal: top.name,
    amount,
    unit,
    nutrient: label,
    share,
    target: targetRounded,
  };

  return {
    nutrient,
    culpritMealId: top.id,
    culpritMealName: top.name,
    amountFromMeal: amount,
    problemFoods: [],
    explanation: tips.explain
      ? tips.explain(explainParams)
      : share >= 40
        ? `"${top.name}" — ~${amount}${unit} ${label} (~${share}% of today's ${targetRounded}${unit} target).`
        : `"${top.name}" — biggest ${label} hit (~${amount}${unit}).`,
    avoidNextTime: tipForNutrient(nutrient, tips),
  };
}

export function buildLocalDayOverageInsights({
  meals,
  current,
  targets,
  micros,
  tips,
}: {
  meals: DailyMealLog[];
  current: MealMacros;
  targets: MealMacros;
  micros?: { sodium?: number; sugar?: number } | null;
  tips?: OverageTipCopy;
}): MacroOverageInsight[] {
  return listOverTargetNutrients(current, targets, micros).map((nutrient) =>
    fallbackMacroOverageInsight(meals, nutrient, targets, tips)
  );
}
