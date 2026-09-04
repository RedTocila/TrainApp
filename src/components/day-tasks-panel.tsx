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
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-card to-card"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <span className="shrink-0 rounded-full border border-border/60 bg-background/70 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground backdrop-blur-sm">
                {platform.common.completedCount(completed.length, tasks.length)}
              </span>
            )}
            {!viewingToday && (
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={goToToday}>
                {platform.calendar.today}
              </Button>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="relative z-10 mb-4 h-1.5 overflow-hidden rounded-full bg-background/60">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        )}
        <div className="relative z-10">
          <DayTasksList
            tasks={tasks}
            macroTargets={schedule.macroTargets}
            dailyMeals={dailyMeals}
            waterMl={waterMl}
            waterGoalMl={schedule.waterGoalMl ?? 2500}
            dateKey={dateKey}
          />
        </div>
      </section>
      <h2 className={cn(dashboard.pageTitle, "pt-2")}>
        {platform.dashboard.myProgress}
      </h2>
    </>
  );
}
