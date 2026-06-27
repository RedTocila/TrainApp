"use client";
import { usePlatformCopy } from "@/components/locale-provider";

import { addDays, format, isToday, isTomorrow } from "date-fns";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DashboardDateLoadingDots } from "@/components/dashboard-date-loading";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { dashboard } from "@/components/dashboard-ui";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const platform = usePlatformCopy();
  const { selectedDate, todayKey, goToToday } = useSelectedDate();
  const { version, mergeEnrichment } = useDashboardSync();
  const [enrichment, setEnrichment] =
    useState<DashboardEnrichmentData>(initialEnrichment);
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

  const { completed } = groupTasksByStatus(tasks);
  const dailyMeals = mergedEnrichment.mealsByDate[dateKey] ?? [];
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
