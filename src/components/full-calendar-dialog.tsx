"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfDay,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { groupTasksByStatus } from "@/components/day-tasks-list";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { formatLocalized } from "@/lib/date-locale";
import { getSundayFirstWeekdayLabels } from "@/lib/locale-labels";
import type { ClientSchedule } from "@/lib/daily-tasks";
import {
  enrichTasksForDate,
  getCalendarDayStatus,
  type DashboardEnrichmentData,
} from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

interface FullCalendarDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}

export function FullCalendarDialog({
  open,
  onClose,
  selectedDate,
  onSelectDate,
  schedule,
  enrichment,
}: FullCalendarDialogProps) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const weekdays = useMemo(() => getSundayFirstWeekdayLabels(locale), [locale]);
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));
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

  useEffect(() => {
    if (open) setViewMonth(startOfMonth(selectedDate));
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const selectedDayTasks = useMemo(
    () => {
      const raw = enrichTasksForDate(selectedDate, schedule, enrichment, now);
      if (activeFrom && isBefore(selectedDate, activeFrom)) return [];
      return raw;
    },
    [selectedDate, schedule, enrichment, now, activeFrom]
  );
  const { active, completed, missed } = useMemo(
    () => groupTasksByStatus(selectedDayTasks),
    [selectedDayTasks]
  );

  if (!open) return null;

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-4xl" aria-label={platform.calendar.fullCalendarTitle} className="max-h-[92%]">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black">{platform.calendar.fullCalendarTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {platform.calendar.tapDayHint}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={platform.common.close}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label={platform.calendar.previousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-black tracking-tight">
              {formatLocalized(viewMonth, "MMMM yyyy", locale)}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label={platform.calendar.nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {platform.calendar.complete}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> {platform.calendar.missed}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary/70" /> {platform.calendar.upcomingActive}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> {platform.calendar.preAccount}
            </span>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {weekdays.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
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
                    onSelect={() => {
                      onSelectDate(day);
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-bold">
              {formatLocalized(selectedDate, "EEEE, MMMM d", locale)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeFrom && isBefore(selectedDate, activeFrom)
                ? platform.calendar.noActivityYet
                : platform.calendar.daySummary(
                    active.length,
                    completed.length,
                    missed.length
                  )}
            </p>
          </div>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
