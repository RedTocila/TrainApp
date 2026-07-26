"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { AdminDayTasksList } from "@/components/admin-day-tasks-list";
import { DateProvider, useSelectedDate } from "@/components/date-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientSchedule } from "@/lib/daily-tasks";
import {
  enrichTasksForDate,
  getCalendarDayStatus,
  type DashboardEnrichmentData,
} from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AdminClientCalendarInner({
  schedule,
  enrichment,
}: {
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [now, setNow] = useState(() => new Date());

  const activeFrom = useMemo(() => {
    if (!enrichment.accountCreatedAt) return null;
    const d = new Date(enrichment.accountCreatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return startOfDay(d);
  }, [enrichment.accountCreatedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const monthStats = useMemo(() => {
    let complete = 0;
    let missed = 0;
    let scheduled = 0;

    for (const day of monthDays) {
      if (!isSameMonth(day, viewMonth)) continue;
      if (activeFrom && isBefore(day, activeFrom)) continue;

      const tasks = enrichTasksForDate(day, schedule, enrichment, now);
      if (tasks.length === 0) continue;

      scheduled += 1;
      const status = getCalendarDayStatus(tasks, day, now);
      if (status === "complete") complete += 1;
      else if (status === "incomplete_past") missed += 1;
    }

    const rate = scheduled > 0 ? Math.round((complete / scheduled) * 100) : 0;
    return { complete, missed, scheduled, rate };
  }, [monthDays, viewMonth, schedule, enrichment, now, activeFrom]);

  const selectedDayTasks = useMemo(() => {
    const raw = enrichTasksForDate(selectedDate, schedule, enrichment, now);
    if (activeFrom && isBefore(selectedDate, activeFrom)) return [];
    return raw;
  }, [selectedDate, schedule, enrichment, now, activeFrom]);

  const completedCount = selectedDayTasks.filter((task) => task.completed).length;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Days report</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-bold">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-center">
            <p className="text-xl font-black text-green-400 sm:text-2xl">
              {monthStats.complete}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              Complete
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-center">
            <p className="text-xl font-black text-red-400 sm:text-2xl">
              {monthStats.missed}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              Lacking
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-center">
            <p className="text-xl font-black sm:text-2xl">{monthStats.scheduled}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              Scheduled
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-center">
            <p className="text-xl font-black text-primary sm:text-2xl">
              {monthStats.rate}%
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              Rate
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
            Complete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white">
              <X className="h-2.5 w-2.5" />
            </span>
            Lacking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white">
              1/3
            </span>
            In progress
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-1.5">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {day.slice(0, 1)}
                  <span className="hidden sm:inline">{day.slice(1)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthDays.map((day) => {
                const rawTasks = enrichTasksForDate(day, schedule, enrichment, now);
                const beforeActive = activeFrom ? isBefore(day, activeFrom) : false;
                const tasks = beforeActive ? [] : rawTasks;
                const dayStatus = getCalendarDayStatus(tasks, day, now);
                const selected = isSameDay(day, selectedDate);
                const inMonth = isSameMonth(day, viewMonth);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(!inMonth && "opacity-35")}
                  >
                    <CalendarDayDot
                      date={day}
                      tasks={tasks}
                      dayStatus={dayStatus}
                      selected={selected}
                      onSelect={() => setSelectedDate(day)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="min-w-0 rounded-2xl border border-border/60 bg-secondary/30 p-4 lg:sticky lg:top-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  To-do
                </p>
                <p className="text-sm font-bold leading-snug">
                  {format(selectedDate, "EEEE, MMM d")}
                </p>
              </div>
              {selectedDayTasks.length > 0 ? (
                <span className="shrink-0 rounded-full bg-background/70 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {completedCount}/{selectedDayTasks.length}
                </span>
              ) : null}
            </div>
            {selectedDayTasks.length > 0 ? (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.round(
                      (completedCount / selectedDayTasks.length) * 100
                    )}%`,
                  }}
                />
              </div>
            ) : null}
            <AdminDayTasksList tasks={selectedDayTasks} />
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminClientCalendar({
  schedule,
  enrichment,
}: {
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}) {
  return (
    <DateProvider>
      <AdminClientCalendarInner schedule={schedule} enrichment={enrichment} />
    </DateProvider>
  );
}
