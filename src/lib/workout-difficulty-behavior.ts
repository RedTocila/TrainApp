import { addDays, format, parseISO } from "date-fns";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";

export type WorkoutDifficultyBehaviorContext = {
  dateKey: string;
  workoutsLast7Days: number;
  workoutsLast14Days: number;
  daysWithMealsLast7Days: number;
  avgWaterMlLast3Days: number | null;
  waterMlToday: number | null;
  habitCompletionDaysLast7: number;
  waterGoalMl?: number;
};

function dateKeysInRange(endDateKey: string, days: number): string[] {
  const end = parseISO(`${endDateKey}T12:00:00`);
  return Array.from({ length: days }, (_, index) =>
    formatDateKey(addDays(end, -(days - 1 - index)))
  );
}

export function buildWorkoutDifficultyBehaviorContext(
  enrichment: DashboardEnrichmentData,
  dateKey: string,
  options?: { waterGoalMl?: number }
): WorkoutDifficultyBehaviorContext {
  const completed = new Set(enrichment.workoutCompletedDates);
  const last7 = dateKeysInRange(dateKey, 7);
  const last14 = dateKeysInRange(dateKey, 14);
  const last3 = dateKeysInRange(dateKey, 3);

  const workoutsLast7Days = last7.filter((key) => completed.has(key)).length;
  const workoutsLast14Days = last14.filter((key) => completed.has(key)).length;

  const daysWithMealsLast7Days = last7.filter(
    (key) => (enrichment.mealsByDate[key]?.length ?? 0) > 0
  ).length;

  const waterSamples = last3
    .map((key) => enrichment.waterByDate[key])
    .filter((value): value is number => typeof value === "number" && value > 0);
  const avgWaterMlLast3Days =
    waterSamples.length > 0
      ? Math.round(waterSamples.reduce((sum, value) => sum + value, 0) / waterSamples.length)
      : null;

  const waterMlToday = enrichment.waterByDate[dateKey] ?? null;

  const habitCompletionDaysLast7 = last7.filter(
    (key) => (enrichment.completionsByDate[key]?.length ?? 0) > 0
  ).length;

  return {
    dateKey,
    workoutsLast7Days,
    workoutsLast14Days,
    daysWithMealsLast7Days,
    avgWaterMlLast3Days,
    waterMlToday,
    habitCompletionDaysLast7,
    waterGoalMl: options?.waterGoalMl,
  };
}

export function summarizeBehaviorContextForAi(context: WorkoutDifficultyBehaviorContext): string {
  const lines = [
    `Reference date: ${context.dateKey}`,
    `Workouts completed last 7 days: ${context.workoutsLast7Days}`,
    `Workouts completed last 14 days: ${context.workoutsLast14Days}`,
    `Days with meals logged (last 7): ${context.daysWithMealsLast7Days}`,
    `Days with habits/tasks logged (last 7): ${context.habitCompletionDaysLast7}`,
  ];

  if (context.waterMlToday != null) {
    lines.push(`Water today: ${context.waterMlToday} ml`);
  }
  if (context.avgWaterMlLast3Days != null) {
    lines.push(`Average water last 3 days: ${context.avgWaterMlLast3Days} ml`);
  }
  if (context.waterGoalMl) {
    lines.push(`Daily water goal: ${context.waterGoalMl} ml`);
  }

  return lines.join("\n");
}
