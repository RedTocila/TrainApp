import type { FullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

export function mergeCalendarEnrichment(
  base: DashboardEnrichmentData,
  next: DashboardEnrichmentData
): DashboardEnrichmentData {
  const workoutSet = new Set(base.workoutCompletedDates);
  for (const date of next.workoutCompletedDates) {
    workoutSet.add(date);
  }

  return {
    ...base,
    completionsByDate: { ...base.completionsByDate, ...next.completionsByDate },
    waterByDate: { ...base.waterByDate, ...next.waterByDate },
    mealsByDate: { ...base.mealsByDate, ...next.mealsByDate },
    workoutCompletedDates: [...workoutSet],
    accountCreatedAt: next.accountCreatedAt ?? base.accountCreatedAt,
  };
}

export function mergeCalendarSchedule(
  base: ClientSchedule,
  slice: FullCalendarMonthSlice["scheduleSlice"]
): ClientSchedule {
  const workoutById = new Map(
    (base.scheduledWorkouts ?? []).map((w) => [w.id, w])
  );
  for (const w of slice.scheduledWorkouts) {
    workoutById.set(w.id, w);
  }

  const nutritionById = new Map(
    (base.scheduledNutritionDays ?? []).map((n) => [n.id, n])
  );
  for (const n of slice.scheduledNutritionDays) {
    nutritionById.set(n.id, n);
  }

  return {
    ...base,
    scheduledWorkouts: [...workoutById.values()],
    scheduledNutritionDays: [...nutritionById.values()],
    scheduledCardioByDate: {
      ...(base.scheduledCardioByDate ?? {}),
      ...slice.scheduledCardioByDate,
    },
    habitsByDate: {
      ...(base.habitsByDate ?? {}),
      ...slice.habitsByDate,
    },
  };
}
