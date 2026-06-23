"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { tasksForDay } from "@/components/calendar-strip";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { useSelectedDate } from "@/components/date-provider";
import { enrichDailyTasks } from "@/lib/enrich-daily-tasks";
import { getDailyLog } from "@/lib/actions/logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { isWorkoutCompletedOnDate } from "@/lib/actions/workout-sessions";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DailyMealLog, Meal } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MissedButton } from "@/components/missed-items-dialog";

function panelTitle(date: Date): string {
  if (isToday(date)) return "Today's To Do";
  if (isTomorrow(date)) return "Tomorrow's To Do";
  return `${format(date, "EEEE")}'s To Do`;
}

function toCompletionSets(
  map: Record<string, string[]>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [date, ids] of Object.entries(map)) {
    out[date] = new Set(ids);
  }
  return out;
}

export function DayTasksPanel({
  clientId,
  schedule,
  completionsByDate,
}: {
  clientId: string;
  schedule: ClientSchedule;
  completionsByDate: Record<string, string[]>;
}) {
  const { selectedDate } = useSelectedDate();
  const [waterMl, setWaterMl] = useState(0);
  const [dailyMeals, setDailyMeals] = useState<DailyMealLog[]>([]);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [, startTransition] = useTransition();
  const completions = useMemo(
    () => toCompletionSets(completionsByDate),
    [completionsByDate]
  );

  const waterGoalMl = schedule.waterGoalMl ?? 2500;

  const planMeals = useMemo((): Meal[] => {
    const dateKey = formatDateKey(selectedDate);
    const scheduled = schedule.scheduledNutritionDays?.find(
      (s) => s.scheduled_date === dateKey
    );
    const meals =
      scheduled?.nutrition_plans?.meals ??
      schedule.nutritionAssignment?.nutrition_plans?.meals ??
      [];
    return [...meals].sort((a, b) => a.order_index - b.order_index);
  }, [schedule, selectedDate]);

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const [log, meals, completedWorkout] = await Promise.all([
        getDailyLog(clientId, dateKey),
        getDailyMealLogs(clientId, dateKey),
        isWorkoutCompletedOnDate(clientId, dateKey),
      ]);
      setWaterMl(log?.water_ml ?? 0);
      setDailyMeals(meals);
      setWorkoutCompleted(completedWorkout);
    });
  }, [selectedDate, clientId]);

  const tasks = useMemo(() => {
    const built = tasksForDay(schedule, completions, selectedDate);
    return enrichDailyTasks(built, {
      dateKey: formatDateKey(selectedDate),
      waterMl,
      waterGoalMl,
      dailyMeals,
      planMeals,
      workoutCompleted,
    });
  }, [
    schedule,
    completions,
    selectedDate,
    waterMl,
    waterGoalMl,
    dailyMeals,
    planMeals,
    workoutCompleted,
  ]);

  const { active, missed, completed } = groupTasksByStatus(tasks);

  const summary =
    tasks.length === 0
      ? "No tasks scheduled"
      : `${active.length} active · ${completed.length} completed`;

  const missedTaskItems = missed.map((task) => ({
    id: task.id,
    label: task.label,
    detail: task.detail,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          {panelTitle(selectedDate)}
          <MissedButton
            count={missed.length}
            title="Missed tasks"
            hint="Try to stay on schedule tomorrow."
            items={missedTaskItems}
          />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(selectedDate, "MMMM d, yyyy")} · {summary}
        </p>
      </CardHeader>
      <CardContent>
        <DayTasksList tasks={tasks} />
      </CardContent>
    </Card>
  );
}
