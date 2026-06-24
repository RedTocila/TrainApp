"use client";

import { addDays, format, isToday, isTomorrow } from "date-fns";
import { ChevronDown, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { MissedButton } from "@/components/missed-items-dialog";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { isDayEnded } from "@/lib/meal-times";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function panelTitle(date: Date): string {
  if (isToday(date)) return "Today's To Do";
  if (isTomorrow(date)) return "Tomorrow's To Do";
  return `${format(date, "EEEE")}'s To Do`;
}

export function DayTasksPanel({
  clientId,
  schedule,
  initialEnrichment,
}: {
  clientId: string;
  schedule: ClientSchedule;
  initialEnrichment: DashboardEnrichmentData;
}) {
  const { selectedDate } = useSelectedDate();
  const { version, mergeEnrichment } = useDashboardSync();
  const [enrichment, setEnrichment] =
    useState<DashboardEnrichmentData>(initialEnrichment);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dateKey = formatDateKey(selectedDate);

  useEffect(() => {
    if (version === 0) return;

    const from = formatDateKey(addDays(new Date(), -3));
    const to = formatDateKey(addDays(new Date(), 28));

    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(clientId, from, to);
      setEnrichment(data);
    });
  }, [version, clientId]);

  const mergedEnrichment = useMemo(
    () => mergeEnrichment(enrichment),
    [enrichment, mergeEnrichment]
  );

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, mergedEnrichment);
  }, [schedule, selectedDate, mergedEnrichment]);

  const { missed, completed } = groupTasksByStatus(tasks);
  const allDone = tasks.length > 0 && completed.length === tasks.length;
  const dayEnded = isDayEnded(dateKey);

  const missedTaskItems = missed.map((task) => ({
    id: task.id,
    label: task.label,
    detail: task.detail,
  }));

  return (
    <Card>
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6 sm:py-4"
          aria-expanded={open}
        >
          <CardTitle className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-lg">
            <ListChecks className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
            <span className="shrink-0">{panelTitle(selectedDate)}</span>
            {tasks.length > 0 && (
              <>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    allDone
                      ? "text-green-400"
                      : dayEnded
                        ? "text-red-400"
                        : "text-amber-400"
                  )}
                >
                  {allDone ? "Completed" : dayEnded ? "Incomplete" : "In progress"}
                </span>
                {!allDone && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {completed.length}/{tasks.length} completed
                  </span>
                )}
              </>
            )}
            <MissedButton
              count={missed.length}
              title="Missed tasks"
              hint="Try to stay on schedule tomorrow."
              items={missedTaskItems}
            />
          </CardTitle>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="border-t border-border/60 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <DayTasksList tasks={tasks} />
        </CardContent>
      )}
    </Card>
  );
}
