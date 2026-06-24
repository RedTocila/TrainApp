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

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Calendar</CardTitle>
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
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="text-2xl font-black text-green-400">{monthStats.complete}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Complete days
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="text-2xl font-black text-red-400">{monthStats.missed}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Lacking days
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="text-2xl font-black">{monthStats.scheduled}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Scheduled days
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="text-2xl font-black text-primary">{monthStats.rate}%</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Completion rate
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-3 w-3" />
            </span>
            Complete
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
              <X className="h-3 w-3" />
            </span>
            Lacking
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1.5">
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              1/3
            </span>
            In progress
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-sm"
            >
              {day}
            </div>
          ))}
          {monthDays.map((day) => {
            const rawTasks = enrichTasksForDate(day, schedule, enrichment, now);
            const beforeActive = activeFrom ? isBefore(day, activeFrom) : false;
            const tasks = beforeActive ? [] : rawTasks;
            const dayStatus = getCalendarDayStatus(tasks, day, now);
            const selected = isSameDay(day, selectedDate);
            const inMonth = isSameMonth(day, viewMonth);

            return (
              <div key={day.toISOString()} className={cn(!inMonth && "opacity-35")}>
                <CalendarDayDot
                  date={day}
                  tasks={tasks}
                  dayStatus={dayStatus}
                  selected={selected}
                  size="large"
                  onSelect={() => setSelectedDate(day)}
                />
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-bold">{format(selectedDate, "EEEE, MMMM d")}</p>
          <div className="mt-4">
            <AdminDayTasksList tasks={selectedDayTasks} />
          </div>
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
