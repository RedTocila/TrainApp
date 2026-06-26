import type { MealMacros } from "@/lib/meal-utils";
import type { MacroTargets } from "@/lib/meal-score";

/** Acceptable deviation from protein, carbs, and fat targets (±20%). */
export const DAILY_MACRO_TOLERANCE_PCT = 0.2;

/** Fixed ± band for daily calories (not percentage-based). */
export const DAILY_CALORIE_TOLERANCE = 300;

const MACRO_MIN_TOLERANCE: Omit<MealMacros, "calories"> = {
  protein: 5,
  carbs: 10,
  fat: 5,
};

const MACRO_KEYS: (keyof MealMacros)[] = ["calories", "protein", "carbs", "fat"];

export function macroToleranceBand(
  target: number,
  key: keyof MealMacros,
  pct = DAILY_MACRO_TOLERANCE_PCT
): { min: number; max: number } {
  if (target <= 0) return { min: 0, max: 0 };
  const delta =
    key === "calories"
      ? DAILY_CALORIE_TOLERANCE
      : Math.max(target * pct, MACRO_MIN_TOLERANCE[key]);
  return {
    min: Math.max(0, Math.round(target - delta)),
    max: Math.round(target + delta),
  };
}

export function macroWithinDailyTarget(
  actual: number,
  target: number,
  key: keyof MealMacros
): boolean {
  if (target <= 0) return true;
  const { min, max } = macroToleranceBand(target, key);
  return actual >= min && actual <= max;
}

/** True when every set macro target is within its tolerance band (not too low, not too high). */
export function dailyMacrosWithinTarget(
  current: MealMacros,
  targets: MacroTargets
): boolean {
  return MACRO_KEYS.every((key) => {
    const target = targets[key];
    if (target <= 0) return true;
    return macroWithinDailyTarget(current[key], target, key);
  });
}

export function formatMacroProgressLine(
  current: MealMacros,
  targets: MacroTargets
): string {
  const met = dailyMacrosWithinTarget(current, targets);
  const prefix = met ? "✓ " : "";
  return `${prefix}${current.calories}/${targets.calories} cal · P ${current.protein}/${targets.protein}g · C ${current.carbs}/${targets.carbs}g · F ${current.fat}/${targets.fat}g`;
}
