"use client";

import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarStripDay, isInactiveCalendarDay } from "@/components/calendar-strip-day";
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
import { scrollElementIntoHorizontalView } from "@/lib/scroll-horizontal";

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
  /** Extra days shown after today (default 28). */
  futureDays?: number;
}

const VISIBLE_DAYS = 7;
const DEFAULT_FUTURE_DAYS = 28;
const FALLBACK_PAST_DAYS = 3;

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  schedule,
  enrichment,
  futureDays = DEFAULT_FUTURE_DAYS,
}: CalendarStripProps) {
  const [now, setNow] = useState(() => new Date());
  const selectedRef = useRef<HTMLButtonElement>(null);

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
    const today = startOfDay(now);
    // Scroll back to account start (or a short fallback), and forward for planning.
    const rangeStart = activeFrom ?? addDays(today, -FALLBACK_PAST_DAYS);
    const rangeEnd = addDays(today, futureDays);
    const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);

    return Array.from({ length: totalDays }, (_, i) => {
      const day = addDays(rangeStart, i);
      const inactive = isInactiveCalendarDay(day, activeFrom, now);
      const tasks = inactive ? [] : enrichTasksForDate(day, schedule, enrichment, now);
      const dayStatus = getCalendarDayStatus(tasks, day, now);
      return { day, tasks, dayStatus, inactive };
    });
  }, [futureDays, schedule, enrichment, now, activeFrom]);

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

  const visibleDays = dayItems.slice(startIndex, startIndex + VISIBLE_DAYS);

  useEffect(() => {
    const node = selectedRef.current;
    if (!node) return;

    const frame = requestAnimationFrame(() => {
      scrollElementIntoHorizontalView(node, {
        behavior: "smooth",
        inline: "center",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedDate, startIndex]);

  return (
    <div className="calendar-strip bg-background/80 backdrop-blur-sm">
      {/* Mobile / tablet: scrollable week strip */}
      <div
        data-horizontal-scroll
        className="flex min-w-0 items-stretch gap-0 overflow-x-auto overscroll-x-contain px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 md:px-4 lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {dayItems.map(({ day, tasks, dayStatus, inactive }) => (
          <CalendarStripDay
            key={day.toISOString()}
            buttonRef={isSameDay(day, selectedDate) ? selectedRef : undefined}
            date={day}
            selected={isSameDay(day, selectedDate)}
            tasks={tasks}
            dayStatus={dayStatus}
            inactive={inactive}
            layout="scroll"
            onSelect={() => onSelectDate(day)}
          />
        ))}
      </div>

      {/* Desktop: fixed 7-day window centered on selection */}
      <div className="hidden min-w-0 grid-cols-7 items-stretch px-6 py-1 lg:grid">
        {visibleDays.map(({ day, tasks, dayStatus, inactive }) => (
          <CalendarStripDay
            key={day.toISOString()}
            date={day}
            selected={isSameDay(day, selectedDate)}
            tasks={tasks}
            dayStatus={dayStatus}
            inactive={inactive}
            layout="grid"
            onSelect={() => onSelectDate(day)}
          />
        ))}
      </div>
    </div>
  );
}

/** @deprecated Use enrichTasksForDate with dashboard enrichment data */
export function tasksForDay(
  schedule: ClientSchedule,
  completionsByDate: Record<string, Set<string>>,
  date: Date
): DailyTask[] {
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
