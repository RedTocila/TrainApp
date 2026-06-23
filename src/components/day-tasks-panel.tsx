"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { tasksForDay } from "@/components/calendar-strip";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { useSelectedDate } from "@/components/date-provider";
import { enrichWaterTask } from "@/lib/enrich-daily-tasks";
import { getDailyLog } from "@/lib/actions/logs";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [, startTransition] = useTransition();
  const completions = useMemo(
    () => toCompletionSets(completionsByDate),
    [completionsByDate]
  );

  const waterGoalMl = schedule.waterGoalMl ?? 2500;

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const log = await getDailyLog(clientId, dateKey);
      setWaterMl(log?.water_ml ?? 0);
    });
  }, [selectedDate, clientId]);

  const tasks = useMemo(() => {
    const built = tasksForDay(schedule, completions, selectedDate);
    return enrichWaterTask(built, waterMl, waterGoalMl);
  }, [schedule, completions, selectedDate, waterMl, waterGoalMl]);

  const { inProgress, missed, completed } = groupTasksByStatus(tasks);

  const summary =
    tasks.length === 0
      ? "No tasks scheduled"
      : `${inProgress.length} in progress · ${completed.length} completed${
          missed.length > 0 ? ` · ${missed.length} missed` : ""
        }`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          {panelTitle(selectedDate)}
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
