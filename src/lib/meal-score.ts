import type { MealFormData } from "@/lib/meal-utils";

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealScoreResult = {
  score: number;
  label: "Great" | "Good" | "OK" | "Needs work";
  reasons: string[];
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pctDiff(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.abs(value - target) / target;
}

export function scoreMeal({
  meal,
  targets,
  goal,
}: {
  meal: MealFormData;
  targets: MacroTargets;
  goal?: string | null;
}): MealScoreResult {
  // Heuristic scoring (0–100) based on daily targets and goal bias.
  // Assumes ~3 meals/day; snack can be smaller but we'll keep it simple and consistent.
  const mealsPerDay = 3;
  const baseTargets = {
    calories: targets.calories / mealsPerDay,
    protein: targets.protein / mealsPerDay,
    carbs: targets.carbs / mealsPerDay,
    fat: targets.fat / mealsPerDay,
  };

  const bias =
    goal === "build_muscle"
      ? { protein: 0.45, calories: 0.25, carbs: 0.2, fat: 0.1 }
      : goal === "lose_weight"
        ? { protein: 0.4, calories: 0.35, carbs: 0.15, fat: 0.1 }
        : goal === "improve_endurance"
          ? { protein: 0.25, calories: 0.25, carbs: 0.4, fat: 0.1 }
          : { protein: 0.3, calories: 0.3, carbs: 0.25, fat: 0.15 };

  const diffs = {
    calories: pctDiff(meal.macros.calories, baseTargets.calories),
    protein: pctDiff(meal.macros.protein, baseTargets.protein),
    carbs: pctDiff(meal.macros.carbs, baseTargets.carbs),
    fat: pctDiff(meal.macros.fat, baseTargets.fat),
  };

  // Convert diffs to penalties; small deviation is fine, big deviation is penalized.
  const penalty =
    clamp(diffs.calories, 0, 1.5) * 40 * bias.calories +
    clamp(diffs.protein, 0, 1.5) * 40 * bias.protein +
    clamp(diffs.carbs, 0, 1.5) * 40 * bias.carbs +
    clamp(diffs.fat, 0, 1.5) * 40 * bias.fat;

  let score = Math.round(clamp(100 - penalty, 0, 100));

  const reasons: string[] = [];
  if (meal.macros.protein >= baseTargets.protein * 0.9) reasons.push("Strong protein for your goal");
  else reasons.push("Protein is low for your goal");

  if (meal.macros.calories <= baseTargets.calories * 1.2) reasons.push("Calories are in a reasonable range");
  else reasons.push("Calories are high for a single meal");

  if (goal === "improve_endurance") {
    if (meal.macros.carbs >= baseTargets.carbs * 0.8) reasons.push("Good carbs for training fuel");
    else reasons.push("Carbs may be low for endurance fuel");
  } else {
    // balanced note
    const total = meal.macros.protein + meal.macros.carbs + meal.macros.fat;
    if (total > 0) reasons.push("Macros are logged and trackable");
  }

  const label: MealScoreResult["label"] =
    score >= 85 ? "Great" : score >= 70 ? "Good" : score >= 55 ? "OK" : "Needs work";

  // Keep reasons short in the popup.
  return { score, label, reasons: reasons.slice(0, 3) };
}

