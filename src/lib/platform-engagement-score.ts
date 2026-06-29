import { differenceInCalendarDays, parseISO } from "date-fns";

import { waterMetDailyMinimum } from "@/lib/water-targets";

export type PlatformEngagementMetrics = {
  daysInPeriod: number;
  workoutsCompleted: number;
  daysWithMeals: number;
  daysWithWaterGoalMet: number;
  habitCompletions: number;
  avgProtein: number;
  proteinTarget: number;
};

export const PLATFORM_SCORE_WEIGHTS = {
  nutrition: 0.5,
  workout: 0.3,
  lifestyle: 0.2,
} as const;

/** Share of the lifestyle bucket (habits + water). */
export const LIFESTYLE_SCORE_WEIGHTS = {
  habits: 0.6,
  water: 0.4,
} as const;

export function scoreFromRatio(ratio: number): number {
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function nutritionEngagementRatio(metrics: PlatformEngagementMetrics): number {
  const days = Math.max(1, metrics.daysInPeriod);
  const weeks = Math.max(days / 7, 1 / 7);

  const proteinOk =
    metrics.proteinTarget > 0 &&
    metrics.avgProtein >= metrics.proteinTarget * 0.85;

  const mealDaysTarget = Math.ceil(weeks * 5);
  const mealLoggingRatio = Math.min(1, metrics.daysWithMeals / Math.max(1, mealDaysTarget));

  const proteinRatio =
    proteinOk
      ? 1
      : metrics.proteinTarget > 0
        ? Math.min(1, metrics.avgProtein / (metrics.proteinTarget * 0.85))
        : 0;

  if (metrics.daysWithMeals >= mealDaysTarget && proteinOk) return 1;

  return Math.min(1, mealLoggingRatio * 0.4 + proteinRatio * 0.6);
}

function workoutEngagementRatio(metrics: PlatformEngagementMetrics): number {
  const days = Math.max(1, metrics.daysInPeriod);
  const weeks = Math.max(days / 7, 1 / 7);
  const workoutTarget = weeks * 4;
  return Math.min(1, metrics.workoutsCompleted / workoutTarget);
}

function lifestyleEngagementRatio(metrics: PlatformEngagementMetrics): number {
  const habitRatio = habitEngagementRatio(metrics);
  const waterRatio = waterEngagementRatio(metrics);

  return Math.min(
    1,
    habitRatio * LIFESTYLE_SCORE_WEIGHTS.habits +
      waterRatio * LIFESTYLE_SCORE_WEIGHTS.water
  );
}

function habitEngagementRatio(metrics: PlatformEngagementMetrics): number {
  const days = Math.max(1, metrics.daysInPeriod);
  const weeks = Math.max(days / 7, 1 / 7);
  const habitTarget = weeks * 14;
  return Math.min(1, metrics.habitCompletions / habitTarget);
}

function waterEngagementRatio(metrics: PlatformEngagementMetrics): number {
  const days = Math.max(1, metrics.daysInPeriod);
  const weeks = Math.max(days / 7, 1 / 7);
  const waterDaysTarget = Math.ceil(weeks * 5);
  return Math.min(
    1,
    metrics.daysWithWaterGoalMet / Math.max(1, waterDaysTarget)
  );
}

export type PlatformScoreBreakdown = {
  overall: number;
  nutrition: number;
  workout: number;
  lifestyle: number;
  habits: number;
  water: number;
};

export type PlatformScoreEntry = {
  score: number;
  breakdown: PlatformScoreBreakdown;
};

export function computePlatformScoreBreakdown(
  metrics: PlatformEngagementMetrics
): PlatformScoreBreakdown {
  const nutrition = scoreFromRatio(nutritionEngagementRatio(metrics));
  const workout = scoreFromRatio(workoutEngagementRatio(metrics));
  const habits = scoreFromRatio(habitEngagementRatio(metrics));
  const water = scoreFromRatio(waterEngagementRatio(metrics));
  const lifestyle = scoreFromRatio(lifestyleEngagementRatio(metrics));

  const overall = Math.round(
    nutrition * PLATFORM_SCORE_WEIGHTS.nutrition +
      workout * PLATFORM_SCORE_WEIGHTS.workout +
      lifestyle * PLATFORM_SCORE_WEIGHTS.lifestyle
  );

  return { overall, nutrition, workout, lifestyle, habits, water };
}

/** Overall score: mostly nutrition, then workouts, then habits + water. */
export function computeOverallPlatformScore(metrics: PlatformEngagementMetrics): number {
  return computePlatformScoreBreakdown(metrics).overall;
}

export function daysSinceDate(isoDate: string, until: Date = new Date()): number {
  const start = parseISO(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  return Math.max(1, differenceInCalendarDays(until, start) + 1);
}

export function platformScoreTone(
  score: number
): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 45) return "mid";
  return "low";
}
