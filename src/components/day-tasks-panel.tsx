"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { MissedButton } from "@/components/missed-items-dialog";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import type { DailyMealLog } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function panelTitle(date: Date): string {
  if (isToday(date)) return "Today's To Do";
  if (isTomorrow(date)) return "Tomorrow's To Do";
  return `${format(date, "EEEE")}'s To Do`;
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
  const { version } = useDashboardSync();
  const [enrichment, setEnrichment] = useState({
    completionsByDate,
    waterByDate: {} as Record<string, number>,
    mealsByDate: {} as Record<string, DailyMealLog[]>,
    workoutCompletedDates: [] as string[],
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    setEnrichment({
      completionsByDate: {},
      waterByDate: {},
      mealsByDate: {},
      workoutCompletedDates: [],
    });
    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(clientId, dateKey, dateKey);
      setEnrichment(data);
    });
  }, [selectedDate, clientId, version]);

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, enrichment);
  }, [schedule, selectedDate, enrichment]);

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
