"use client";

import { addDays, isBefore, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDayCard } from "@/components/calendar-day-card";
import { Button } from "@/components/ui/button";
import {
  type ClientSchedule,
  type DailyTask,
} from "@/lib/daily-tasks";
import {
  enrichTasksForDate,
  getCalendarDayStatus,
  type DashboardEnrichmentData,
} from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
  daysCount?: number;
}

const VISIBLE_DAYS = 7;

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  schedule,
  enrichment,
  daysCount = 28,
}: CalendarStripProps) {
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

  const dayItems = useMemo(() => {
    const rangeStart = addDays(now, -3);
    return Array.from({ length: daysCount }, (_, i) => {
      const day = addDays(rangeStart, i);
      const rawTasks = enrichTasksForDate(day, schedule, enrichment, now);
      const beforeActive = activeFrom ? isBefore(day, activeFrom) : false;
      const tasks = beforeActive ? [] : rawTasks;
      const dayStatus = getCalendarDayStatus(tasks, day, now);
      return { day, tasks, dayStatus };
    });
  }, [daysCount, schedule, enrichment, now, activeFrom]);

  const selectedIndex = useMemo(
    () => dayItems.findIndex(({ day }) => isSameDay(day, selectedDate)),
    [dayItems, selectedDate]
  );

  const startForIndex = useCallback(
    (index: number) => {
      const maxStart = Math.max(0, dayItems.length - VISIBLE_DAYS);
      const centered = index - Math.floor(VISIBLE_DAYS / 2);
      return Math.min(Math.max(0, centered), maxStart);
    },
    [dayItems.length]
  );

  const startIndex = useMemo(() => {
    if (selectedIndex === -1) return 0;
    return startForIndex(selectedIndex);
  }, [selectedIndex, startForIndex]);

  const navigateDay = (direction: "prev" | "next") => {
    if (selectedIndex === -1) return;

    const delta = direction === "prev" ? -1 : 1;
    const nextIndex = selectedIndex + delta;
    if (nextIndex < 0 || nextIndex >= dayItems.length) return;

    onSelectDate(dayItems[nextIndex].day);
  };

  const visibleDays = dayItems.slice(startIndex, startIndex + VISIBLE_DAYS);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < dayItems.length - 1;

  return (
    <div className="flex items-stretch gap-1 px-1.5 py-2 sm:gap-2 sm:px-4 sm:py-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="hidden h-8 w-8 shrink-0 self-center sm:h-9 sm:w-9 lg:inline-flex"
        disabled={!canGoPrev}
        aria-label="Previous day"
        onClick={() => navigateDay("prev")}
      >
        <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </Button>

      <div className="hidden min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 lg:grid lg:gap-3">
        {visibleDays.map(({ day, tasks, dayStatus }) => (
          <CalendarDayCard
            key={day.toISOString()}
            date={day}
            selected={isSameDay(day, selectedDate)}
            tasks={tasks}
            dayStatus={dayStatus}
            onSelect={() => onSelectDate(day)}
            strip
          />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 lg:hidden [&::-webkit-scrollbar]:hidden">
        {dayItems.map(({ day, tasks, dayStatus }) => (
          <div key={day.toISOString()} className="w-[3.75rem] shrink-0 sm:w-[4.75rem]">
            <CalendarDayCard
              date={day}
              selected={isSameDay(day, selectedDate)}
              tasks={tasks}
              dayStatus={dayStatus}
              onSelect={() => onSelectDate(day)}
              strip
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="hidden h-8 w-8 shrink-0 self-center sm:h-9 sm:w-9 lg:inline-flex"
        disabled={!canGoNext}
        aria-label="Next day"
        onClick={() => navigateDay("next")}
      >
        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </Button>
    </div>
  );
}

/** @deprecated Use enrichTasksForDate with dashboard enrichment data */
export function tasksForDay(
  schedule: ClientSchedule,
  completionsByDate: Record<string, Set<string>>,
  date: Date
): DailyTask[] {
  const dateKey = formatDateKey(date);
  const enrichment: DashboardEnrichmentData = {
    completionsByDate: Object.fromEntries(
      Object.entries(completionsByDate).map(([key, ids]) => [key, [...ids]])
    ),
    waterByDate: {},
    mealsByDate: {},
    workoutCompletedDates: [],
  };
  return enrichTasksForDate(date, schedule, enrichment);
}
