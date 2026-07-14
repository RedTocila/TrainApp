import type { CoachCopy } from "@/lib/coach-copy";
import type { CoachLabels } from "@/lib/coach-copy";
import {
  anyDailyMacroOverTarget,
  dailyMacrosExceededUpperLimit,
  dailyMacrosWithinTarget,
} from "@/lib/macro-targets";
import {
  waterMetDailyMinimum,
  waterToleranceBand,
} from "@/lib/water-targets";
import type { MealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";
import { isDayEnded, isDeadlinePassed, WATER_DEADLINE } from "@/lib/meal-times";

export type NutritionDayStatus = "good" | "bad" | "missed" | "too_much";

export const DAILY_MICRO_TARGETS = {
  fiber: 25,
  sugar: 50,
  sodium: 2300,
} as const;

/** Sodium only counts as "too high" / todo X at this far above the daily target. */
export const DAILY_SODIUM_EXCEEDED_PCT = 0.4;

export type DailyMicros = {
  fiber: number;
  sugar: number;
  sodium: number;
};

export function sodiumExceededUpperMax(
  target: number = DAILY_MICRO_TARGETS.sodium
): number {
  if (target <= 0) return 0;
  return Math.round(target * (1 + DAILY_SODIUM_EXCEEDED_PCT));
}

/** True when sodium is 40%+ over its daily target. */
export function sodiumExceededDailyUpperLimit(
  actualMg: number,
  targetMg: number = DAILY_MICRO_TARGETS.sodium
): boolean {
  if (targetMg <= 0) return false;
  return actualMg > sodiumExceededUpperMax(targetMg);
}

/** High-limit check for micros that flag when intake is too high. */
export function microExceededHighLimit(
  key: keyof typeof DAILY_MICRO_TARGETS,
  actual: number,
  target: number = DAILY_MICRO_TARGETS[key]
): boolean {
  if (target <= 0) return false;
  if (key === "sodium") return sodiumExceededDailyUpperLimit(actual, target);
  return actual > target;
}

export interface NutritionDayContext {
  current: MealMacros;
  targets: MealMacros;
  waterMl: number;
  waterGoalMl: number;
  dateKey: string;
  mealCount: number;
  now?: Date;
}

/** Health score label "Good" or better (≥70). */
export function isGoodNutritionHealthScore(score: number): boolean {
  return score >= 70;
}

export function getNutritionDayStatuses(
  ctx: NutritionDayContext,
  micros?: DailyMicros
): NutritionDayStatus[] {
  const now = ctx.now ?? new Date();
  const macrosMet = dailyMacrosWithinTarget(ctx.current, ctx.targets);
  const macrosExceeded = dailyMacrosExceededUpperLimit(ctx.current, ctx.targets);
  const macrosOverTarget = anyDailyMacroOverTarget(ctx.current, ctx.targets);
  const waterMet = waterMetDailyMinimum(ctx.waterMl, ctx.waterGoalMl);
  const waterMissed =
    !waterMet && isDeadlinePassed(WATER_DEADLINE, ctx.dateKey, now);
  const dayEnded = isDayEnded(ctx.dateKey, now);
  const nutritionCompleted =
    macrosMet && waterMet && !macrosExceeded;
  const healthGood =
    micros != null &&
    isGoodNutritionHealthScore(
      scoreDailyNutrition({ ...ctx, micros }).score
    );

  const statuses: NutritionDayStatus[] = [];

  // Warn on any overshoot — even when health score is still good.
  if (macrosExceeded || macrosOverTarget) statuses.push("too_much");
  if (waterMissed || (dayEnded && !macrosMet && !macrosExceeded)) {
    statuses.push("missed");
  }
  if (nutritionCompleted || healthGood) {
    statuses.push("good");
  }

  if (
    statuses.length === 0 ||
    (!nutritionCompleted &&
      !healthGood &&
      !macrosExceeded &&
      !macrosOverTarget &&
      !waterMissed)
  ) {
    const proteinLow =
      ctx.targets.protein > 0 && ctx.current.protein < ctx.targets.protein * 0.65;
    const caloriesOverGoal =
      ctx.targets.calories > 0 && ctx.current.calories > ctx.targets.calories;
    const nothingLogged = ctx.mealCount === 0;

    if (
      proteinLow ||
      caloriesOverGoal ||
      (nothingLogged && dayEnded) ||
      (nothingLogged && isDeadlinePassed(WATER_DEADLINE, ctx.dateKey, now))
    ) {
      if (!statuses.includes("bad")) statuses.push("bad");
    }
  }

  return statuses;
}

function pctDiff(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.abs(value - target) / target;
}

export function estimateDailyMicros(
  meals: DailyMealLog[],
  macros: MealMacros
): { fiber: number; sugar: number; sodium: number } {
  const mealCount = meals.length;
  return estimateMealMicros(macros, mealCount);
}

/** Estimated micros for a single logged meal (same heuristics as daily, one meal). */
export function estimateMealMicros(
  macros: MealMacros,
  mealCount = 1
): DailyMicros {
  return {
    fiber: Math.round(macros.carbs * 0.11 + mealCount * 1.5),
    sugar: Math.round(macros.carbs * 0.38),
    sodium: Math.round(mealCount * 520 + macros.calories * 0.75),
  };
}

export function scoreDailyNutrition(ctx: NutritionDayContext & {
  micros: { fiber: number; sugar: number; sodium: number };
}): { score: number; label: "Great" | "Good" | "Fair" | "Poor" } {
  const macrosMet = dailyMacrosWithinTarget(ctx.current, ctx.targets);
  const macrosExceeded = dailyMacrosExceededUpperLimit(ctx.current, ctx.targets);
  const waterMet = waterMetDailyMinimum(ctx.waterMl, ctx.waterGoalMl);

  let score = 100;
  score -= pctDiff(ctx.current.calories, ctx.targets.calories) * 28;
  score -= pctDiff(ctx.current.protein, ctx.targets.protein) * 22;
  score -= pctDiff(ctx.current.carbs, ctx.targets.carbs) * 12;
  score -= pctDiff(ctx.current.fat, ctx.targets.fat) * 10;

  const { min: waterMin } = waterToleranceBand(ctx.waterGoalMl);
  const waterRatio = waterMin > 0 ? Math.min(ctx.waterMl / waterMin, 1.2) : 1;
  if (waterRatio < 1) score -= (1 - waterRatio) * 18;

  if (ctx.mealCount === 0) score -= 25;
  if (macrosExceeded) score = Math.min(score, 42);
  if (macrosMet && waterMet && !macrosExceeded) {
    score = Math.max(score, 86);
  }

  if (ctx.micros.fiber >= 25) score += 4;
  if (ctx.micros.sugar > 60) score -= 6;
  if (sodiumExceededDailyUpperLimit(ctx.micros.sodium)) score -= 8;

  score = Math.round(Math.min(100, Math.max(0, score)));

  const label: "Great" | "Good" | "Fair" | "Poor" =
    score >= 85 ? "Great" : score >= 70 ? "Good" : score >= 55 ? "Fair" : "Poor";

  return { score, label };
}

export function getNutritionStatusAdvice(
  status: NutritionDayStatus,
  copy: CoachCopy,
  labels: CoachLabels,
  ctx: NutritionDayContext
): { title: string; message: string; detail?: string } {
  const { current, targets, waterMl, waterGoalMl } = ctx;
  const waterMet = waterMetDailyMinimum(waterMl, waterGoalMl);

  switch (status) {
    case "too_much":
      return {
        title: labels.exceeded,
        message: labels.macrosExceededHint,
        detail: `${current.calories}/${targets.calories} cal · P ${current.protein}/${targets.protein}g · C ${current.carbs}/${targets.carbs}g · F ${current.fat}/${targets.fat}g`,
      };
    case "missed":
      return {
        title: labels.missed,
        message:
          !waterMet
            ? labels.hydrationHint
            : "You didn't close the day on your macro targets. Log meals earlier tomorrow and plan portions before you're starving.",
        detail:
          !waterMet
            ? `${waterMl}/${ctx.waterGoalMl} ml water`
            : `${current.calories}/${targets.calories} cal logged`,
      };
    case "good":
      return {
        title: copy.nutritionDay.goodTitle,
        message: copy.nutritionDay.goodAdvice[
          ctx.mealCount % copy.nutritionDay.goodAdvice.length
        ],
        detail: `${current.calories} cal · ${ctx.mealCount} meals · ${waterMl} ml water`,
      };
    case "bad":
      return {
        title: copy.nutritionDay.badTitle,
        message: copy.nutritionDay.badAdvice[
          (current.protein + current.calories) % copy.nutritionDay.badAdvice.length
        ],
        detail: `${current.calories}/${targets.calories} cal · P ${current.protein}/${targets.protein}g`,
      };
  }
}
