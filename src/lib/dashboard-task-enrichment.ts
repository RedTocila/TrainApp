import {
  applyTaskCompletions,
  buildDailyTasks,
  type ClientSchedule,
  type DailyTask,
} from "@/lib/daily-tasks";
import { enrichDailyTasks } from "@/lib/enrich-daily-tasks";
import { isDayEnded } from "@/lib/meal-times";
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
    macroTargets: schedule.macroTargets,
    workoutCompleted: data.workoutCompletedDates.includes(dateKey),
  });
}

export type CalendarDayStatus =
  | "complete"
  | "incomplete_past"
  | "incomplete_active"
  | "default";

/** Visual day accent: success / near-complete / behind / future·pre-account. */
export type CompletionTone = "red" | "amber" | "green" | "muted";

/** Near-complete threshold — amber when at least this ratio, green only at 100%. */
export const CALENDAR_AMBER_RATIO = 0.75;

/** Completed-task ratio for a day, or null when there are no tasks. */
export function getDayCompletionRatio(tasks: DailyTask[]): number | null {
  if (tasks.length === 0) return null;
  const done = tasks.filter((task) => task.completed).length;
  return done / tasks.length;
}

/**
 * Calendar day color:
 * - green = 100% complete
 * - amber = ≥75% complete (not full)
 * - red = under 75%
 * - muted = future, pre-account, or no tasks
 */
export function getDayVisualTone(args: {
  date: Date;
  dayStatus: CalendarDayStatus;
  inactive?: boolean;
  now?: Date;
  /** Prefer passing ratio so amber/red thresholds apply. */
  ratio?: number | null;
}): CompletionTone {
  if (args.inactive) return "muted";

  const now = args.now ?? new Date();
  const dayStart = new Date(args.date);
  dayStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  if (dayStart.getTime() > todayStart.getTime()) return "muted";

  if (args.dayStatus === "complete") return "green";

  const ratio = args.ratio;
  if (ratio == null) {
    // No tasks, or caller didn't pass ratio — keep prior status fallback.
    if (args.dayStatus === "incomplete_past") return "red";
    return "muted";
  }

  if (ratio >= 1) return "green";
  if (ratio >= CALENDAR_AMBER_RATIO) return "amber";
  return "red";
}

/** @deprecated Use getDayVisualTone — kept for any stray ratio callers. */
export function getCompletionTone(ratio: number): CompletionTone {
  if (ratio >= 1) return "green";
  if (ratio >= CALENDAR_AMBER_RATIO) return "amber";
  return "red";
}

export function getCalendarDayStatus(
  tasks: DailyTask[],
  date: Date,
  now: Date = new Date()
): CalendarDayStatus {
  if (tasks.length === 0) return "default";

  const allDone = tasks.every((task) => task.completed);
  if (allDone) return "complete";

  const hasUnrecoverableMiss = tasks.some(
    (task) => task.missed && !task.completed && !task.exceeded
  );
  if (hasUnrecoverableMiss) return "incomplete_past";

  const dateKey = formatDateKey(date);
  if (isDayEnded(dateKey, now)) return "incomplete_past";

  if (tasks.some((task) => task.completed)) return "incomplete_active";

  return "default";
}
