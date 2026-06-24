import {
  applyTaskCompletions,
  buildDailyTasks,
  type ClientSchedule,
  type DailyTask,
} from "@/lib/daily-tasks";
import { enrichDailyTasks } from "@/lib/enrich-daily-tasks";
import { dayRelation } from "@/lib/meal-times";
import type { DailyMealLog, Meal } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";

export interface DashboardEnrichmentData {
  completionsByDate: Record<string, string[]>;
  waterByDate: Record<string, number>;
  mealsByDate: Record<string, DailyMealLog[]>;
  workoutCompletedDates: string[];
  /**
   * ISO timestamp (timestamptz) for when the user's account/profile was created.
   * Used to avoid marking days before account creation as "missed".
   */
  accountCreatedAt?: string | null;
}

export function getPlanMealsForDate(
  dateKey: string,
  schedule: ClientSchedule
): Meal[] {
  const scheduled = schedule.scheduledNutritionDays?.find(
    (entry) => entry.scheduled_date === dateKey
  );
  const meals =
    scheduled?.nutrition_plans?.meals ??
    schedule.nutritionAssignment?.nutrition_plans?.meals ??
    [];
  return [...meals].sort((a, b) => a.order_index - b.order_index);
}

export function enrichTasksForDate(
  date: Date,
  schedule: ClientSchedule,
  data: DashboardEnrichmentData,
  now: Date = new Date()
): DailyTask[] {
  const dateKey = formatDateKey(date);
  const completed = new Set(data.completionsByDate[dateKey] ?? []);
  const base = applyTaskCompletions(buildDailyTasks(date, schedule), completed);

  return enrichDailyTasks(base, {
    dateKey,
    now,
    waterMl: data.waterByDate[dateKey] ?? 0,
    waterGoalMl: schedule.waterGoalMl ?? 2500,
    dailyMeals: data.mealsByDate[dateKey] ?? [],
    planMeals: getPlanMealsForDate(dateKey, schedule),
    workoutCompleted: data.workoutCompletedDates.includes(dateKey),
  });
}

export type CalendarDayStatus = "complete" | "incomplete_past" | "default";

export function getCalendarDayStatus(
  tasks: DailyTask[],
  date: Date,
  now: Date = new Date()
): CalendarDayStatus {
  if (tasks.length === 0) return "default";

  const allDone = tasks.every((task) => task.completed);
  if (allDone) return "complete";

  const dateKey = formatDateKey(date);
  if (dayRelation(dateKey, now) === "past") return "incomplete_past";

  return "default";
}
