"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  fetchDashboardEnrichmentForDate,
} from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function panelTitle(date: Date): string {
  if (isToday(date)) return "Today's To Do";
  if (isTomorrow(date)) return "Tomorrow's To Do";
  return `${format(date, "EEEE")}'s To Do`;
}

function buildInitialEnrichment(
  completionsByDate: Record<string, string[]>
): DashboardEnrichmentData {
  return {
    completionsByDate,
    waterByDate: {},
    mealsByDate: {},
    workoutCompletedDates: [],
  };
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
  const { version, mergeEnrichment } = useDashboardSync();
  const [enrichment, setEnrichment] = useState<DashboardEnrichmentData>(() =>
    buildInitialEnrichment(completionsByDate)
  );
  const [, startTransition] = useTransition();
  const dateKey = formatDateKey(selectedDate);

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchDashboardEnrichmentForDate(clientId, dateKey);
      setEnrichment(data);
    });
  }, [selectedDate, clientId, dateKey]);

  useEffect(() => {
    if (version === 0) return;
    startTransition(async () => {
      const data = await fetchDashboardEnrichmentForDate(clientId, dateKey);
      setEnrichment(data);
    });
  }, [version, clientId, dateKey]);

  const mergedEnrichment = useMemo(
    () => mergeEnrichment(enrichment),
    [enrichment, mergeEnrichment]
  );

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, mergedEnrichment);
  }, [schedule, selectedDate, mergedEnrichment]);

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
        <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
          <ListChecks className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
          {panelTitle(selectedDate)}
          <MissedButton
            count={missed.length}
            title="Missed tasks"
            hint="Try to stay on schedule tomorrow."
            items={missedTaskItems}
          />
        </CardTitle>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {format(selectedDate, "MMMM d, yyyy")} · {summary}
        </p>
      </CardHeader>
      <CardContent>
        <DayTasksList tasks={tasks} />
      </CardContent>
    </Card>
  );
}
