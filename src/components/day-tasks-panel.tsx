"use client";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";

import { isToday, isTomorrow } from "date-fns";
import { useMemo } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { dashboard } from "@/components/dashboard-ui";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { enrichTasksForDate } from "@/lib/dashboard-task-enrichment";
import { formatLocalized } from "@/lib/date-locale";
import { cn, formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function panelTitle(
  date: Date,
  platform: ReturnType<typeof usePlatformCopy>,
  locale: ReturnType<typeof useLocale>
): string {
  if (isToday(date)) return platform.dashboard.toDoToday;
  if (isTomorrow(date)) return platform.dashboard.toDoTomorrow;
  return platform.dashboard.toDoOnDay(formatLocalized(date, "EEEE", locale));
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
  const locale = useLocale();
  const { selectedDate, goToToday } = useSelectedDate();
  const { enrichment } = useDashboardEnrichment();
  const dateKey = formatDateKey(selectedDate);

  const tasks = useMemo(() => {
    return enrichTasksForDate(selectedDate, schedule, enrichment);
  }, [schedule, selectedDate, enrichment]);

  const { completed } = groupTasksByStatus(tasks);
  const dailyMeals = enrichment.mealsByDate[dateKey] ?? [];
  const waterMl = enrichment.waterByDate[dateKey] ?? 0;
  const viewingToday = isToday(selectedDate);
  const completionPct =
    tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
  const title = panelTitle(selectedDate, platform, locale);

  return (
    <>
      <section
        aria-label={title}
        className="rounded-3xl border border-border/50 bg-secondary/40 p-4 shadow-inner sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <span className="shrink-0 rounded-full bg-background/70 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {platform.common.completedCount(completed.length, tasks.length)}
              </span>
            )}
            {!viewingToday && (
              <Button type="button" variant="outline" size="sm" onClick={goToToday}>
                {platform.calendar.today}
              </Button>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-background/60">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        )}
        <DayTasksList
          tasks={tasks}
          macroTargets={schedule.macroTargets}
          dailyMeals={dailyMeals}
          waterMl={waterMl}
          waterGoalMl={schedule.waterGoalMl ?? 2500}
          dateKey={dateKey}
        />
      </section>
      <h2 className={cn(dashboard.pageTitle, "pt-2")}>
        {platform.dashboard.myProgress}
      </h2>
    </>
  );
}
