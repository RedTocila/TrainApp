"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { addDays, format, isToday, isTomorrow } from "date-fns";
import { ChevronDown, ListChecks } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function panelTitle(date: Date, platform: ReturnType<typeof usePlatformCopy>): string {
  if (isToday(date)) return platform.dashboard.toDoToday;
  if (isTomorrow(date)) return platform.dashboard.toDoTomorrow;
  return platform.dashboard.toDoOnDay(format(date, "EEEE"));
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
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version, mergeEnrichment } = useDashboardSync();
  const [enrichment, setEnrichment] =
    useState<DashboardEnrichmentData>(initialEnrichment);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dateKey = formatDateKey(selectedDate);
  const previousTodayKey = useRef(todayKey);

  useEffect(() => {
    if (version === 0) return;

    const from = formatDateKey(addDays(new Date(), -3));
    const to = formatDateKey(addDays(new Date(), 28));

    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(clientId, from, to);
      setEnrichment(data);
    });
  }, [version, clientId]);

  useEffect(() => {
    if (previousTodayKey.current === todayKey) return;
    previousTodayKey.current = todayKey;

    const from = formatDateKey(addDays(new Date(), -3));
    const to = formatDateKey(addDays(new Date(), 28));

    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(clientId, from, to);
      setEnrichment(data);
    });
  }, [todayKey, clientId]);

  const mergedEnrichment = useMemo(
    () => mergeEnrichment(enrichment),
    [enrichment, mergeEnrichment]
  );

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, mergedEnrichment);
  }, [schedule, selectedDate, mergedEnrichment]);

  const { missed, exceeded, completed } = groupTasksByStatus(tasks);
  const allDone = tasks.length > 0 && completed.length === tasks.length;
  const dayEnded = isDayEnded(dateKey);
  const hasMissed = missed.length > 0;
  const hasExceeded = exceeded.length > 0;

  const missedTaskItems = missed.map((task) => ({
    id: task.id,
    label: task.label,
    detail: task.detail,
  }));

  const exceededTaskItems = exceeded.map((task) => ({
    id: task.id,
    label: task.label,
    detail: task.detail,
  }));

  return (
    <Card>
      <CardHeader className="p-0">
        <div className="flex w-full items-start gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex w-full min-w-0 items-center gap-2 text-left"
              aria-expanded={open}
            >
              <ListChecks className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
              <span className="min-w-0 text-base font-bold leading-snug sm:text-lg">
                {panelTitle(selectedDate, platform)}
              </span>
            </button>
            {tasks.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 sm:pl-7">
                <span
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    allDone
                      ? "text-green-400"
                      : hasExceeded
                        ? "text-orange-400"
                        : dayEnded || hasMissed
                          ? "text-red-400"
                          : "text-amber-400"
                  )}
                >
                  {allDone
                    ? platform.common.completed
                    : hasExceeded
                      ? coachLabels.exceeded
                      : dayEnded || hasMissed
                        ? platform.common.incomplete
                        : platform.common.inProgress}
                </span>
                {!allDone && (
                  <span className="text-sm font-medium leading-snug text-muted-foreground">
                    {platform.common.completedCount(completed.length, tasks.length)}
                  </span>
                )}
                <MissedButton
                  count={exceeded.length}
                  title={coachLabels.exceededTasks}
                  hint={coachLabels.macrosExceededHint}
                  items={exceededTaskItems}
                  tone="warning"
                  buttonLabel={coachLabels.exceeded}
                />
                <MissedButton
                  count={missed.length}
                  title={coachLabels.missedTasks}
                  hint={coachLabels.tasksMissedHint}
                  items={missedTaskItems}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={open ? platform.aria.collapseTasks : platform.aria.expandTasks}
          >
            <ChevronDown
              className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="border-t border-border/60 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <DayTasksList tasks={tasks} />
        </CardContent>
      )}
    </Card>
  );
}
