"use client";
import { usePlatformCopy } from "@/components/locale-provider";

import { format, isToday, isTomorrow } from "date-fns";
import { useMemo } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { DashboardDateLoadingDots } from "@/components/dashboard-date-loading";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { dashboard } from "@/components/dashboard-ui";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function panelTitle(date: Date, platform: ReturnType<typeof usePlatformCopy>): string {
  if (isToday(date)) return platform.dashboard.toDoToday;
  if (isTomorrow(date)) return platform.dashboard.toDoTomorrow;
  return platform.dashboard.toDoOnDay(format(date, "EEEE"));
}

export function DayTasksPanel({
  clientId: _clientId,
  schedule,
}: {
  clientId: string;
  schedule: ClientSchedule;
  initialEnrichment?: unknown;
}) {
  const platform = usePlatformCopy();
  const { selectedDate, goToToday } = useSelectedDate();
  const { enrichment } = useDashboardEnrichment();
  const dateKey = formatDateKey(selectedDate);

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, enrichment);
  }, [schedule, selectedDate, enrichment]);

  const { completed } = groupTasksByStatus(tasks);
  const dailyMeals = enrichment.mealsByDate[dateKey] ?? [];
  const viewingToday = isToday(selectedDate);
  const completionPct =
    tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

  return (
    <>
      <section aria-label={panelTitle(selectedDate, platform)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className={dashboard.pageTitle}>
            {panelTitle(selectedDate, platform)}
          </h1>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <span className="shrink-0 rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {platform.common.completedCount(completed.length, tasks.length)}
              </span>
            )}
            {!viewingToday && (
              <Button type="button" variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        )}
        <DashboardDateLoadingDots variant="container" />
        <DayTasksList
          tasks={tasks}
          macroTargets={schedule.macroTargets}
          dailyMeals={dailyMeals}
        />
      </section>
      <h2 className={dashboard.pageTitle}>
        {platform.dashboard.myProgress}
      </h2>
    </>
  );
}
