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

/** True when a macro is above its upper tolerance (can't be fixed by eating more today). */
export function macroExceededDailyUpperLimit(
  actual: number,
  target: number,
  key: keyof MealMacros
): boolean {
  if (target <= 0) return false;
  const { max } = macroToleranceBand(target, key);
  return actual > max;
}

/** True when any macro is above its upper tolerance band. */
export function dailyMacrosExceededUpperLimit(
  current: MealMacros,
  targets: MacroTargets
): boolean {
  return listExceededMacroKeys(current, targets).length > 0;
}

/** True when any macro is above its daily target (matches red macro UI). */
export function anyDailyMacroOverTarget(
  current: MealMacros,
  targets: MacroTargets
): boolean {
  return MACRO_KEYS.some((key) => {
    const target = targets[key];
    if (target <= 0) return false;
    return current[key] > target;
  });
}

/** Macro keys currently above the upper tolerance band. */
export function listExceededMacroKeys(
  current: MealMacros,
  targets: MacroTargets
): (keyof MealMacros)[] {
  return MACRO_KEYS.filter((key) => {
    const target = targets[key];
    if (target <= 0) return false;
    return macroExceededDailyUpperLimit(current[key], target, key);
  });
}

const MACRO_KEY_LABELS: Record<keyof MealMacros, string> = {
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
};

/** Amount a macro is above its upper tolerance (0 when within band). */
export function macroSurplusOverTolerance(
  actual: number,
  target: number,
  key: keyof MealMacros
): number {
  if (target <= 0) return 0;
  const { max } = macroToleranceBand(target, key);
  return Math.max(0, Math.round(actual - max));
}

export function dailyMacroSurplus(
  current: MealMacros,
  targets: MacroTargets
): MealMacros {
  return {
    calories: macroSurplusOverTolerance(current.calories, targets.calories, "calories"),
    protein: macroSurplusOverTolerance(current.protein, targets.protein, "protein"),
    carbs: macroSurplusOverTolerance(current.carbs, targets.carbs, "carbs"),
    fat: macroSurplusOverTolerance(current.fat, targets.fat, "fat"),
  };
}

export function formatExceededMacroSummary(
  current: MealMacros,
  targets: MacroTargets
): string {
  const keys = listExceededMacroKeys(current, targets);
  if (keys.length === 0) return "";

  const parts = keys.map((key) => {
    const surplus = macroSurplusOverTolerance(current[key], targets[key], key);
    const label = MACRO_KEY_LABELS[key];
    const unit = key === "calories" ? " kcal" : "g";
    return `+${surplus}${unit} ${label}`;
  });

  return parts.join(" · ");
}

export function macroExceededAttentionMessage(
  current: MealMacros,
  targets: MacroTargets
): string | null {
  const keys = listExceededMacroKeys(current, targets);
  if (keys.length === 0) return null;

  const summary = formatExceededMacroSummary(current, targets);
  return `You went over your macro limit (${summary}). Eat lighter portions tomorrow and review today's meals.`;
}

export function formatMacroProgressLine(
  current: MealMacros,
  targets: MacroTargets
): string {
  const met = dailyMacrosWithinTarget(current, targets);
  const exceeded = dailyMacrosExceededUpperLimit(current, targets);
  const prefix = met ? "✓ " : exceeded ? "↑ " : "";
  const suffix = exceeded ? ` · over limit (${formatExceededMacroSummary(current, targets)})` : "";
  return `${prefix}${current.calories}/${targets.calories} cal · P ${current.protein}/${targets.protein}g · C ${current.carbs}/${targets.carbs}g · F ${current.fat}/${targets.fat}g${suffix}`;
}
