"use client";

import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
} from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarStripDay, isInactiveCalendarDay } from "@/components/calendar-strip-day";
import { HeaderCalendarPortal } from "@/components/header-calendar-slot";
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
import {
  DASHBOARD_LOOKAHEAD_DAYS,
  DASHBOARD_LOOKBACK_DAYS,
} from "@/lib/dashboard-window";

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
  /** Extra days shown after today. */
  futureDays?: number;
}

const VISIBLE_DAYS = 7;
const FALLBACK_PAST_DAYS = 3;

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  schedule,
  enrichment,
  futureDays = DASHBOARD_LOOKAHEAD_DAYS,
}: CalendarStripProps) {
  const [now, setNow] = useState(() => new Date());
  const selectedRef = useRef<HTMLButtonElement>(null);
  const centeredKey = useRef<string | null>(null);
  const [scrollerNode, setScrollerNode] = useState<HTMLDivElement | null>(null);

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
    const lookbackStart = addDays(today, -DASHBOARD_LOOKBACK_DAYS);
    const rangeStart =
      activeFrom && activeFrom > lookbackStart
        ? activeFrom
        : activeFrom
          ? lookbackStart
          : addDays(today, -FALLBACK_PAST_DAYS);
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

  const desktopCells = useMemo(() => {
    const center = selectedIndex >= 0 ? selectedIndex : 0;
    const half = Math.floor(VISIBLE_DAYS / 2);
    return Array.from({ length: VISIBLE_DAYS }, (_, column) => {
      return dayItems[center - half + column] ?? null;
    });
  }, [dayItems, selectedIndex]);

  const rangeSignature = `${dayItems[0]?.day.getTime() ?? 0}:${dayItems.length}`;

  const centerSelected = (behavior: ScrollBehavior) => {
    const node = selectedRef.current;
    const scroller = scrollerNode;
    if (!node || !scroller) return;
    const dayWidth = node.offsetWidth || 56;
    const pad = Math.max(0, (scroller.clientWidth - dayWidth) / 2);
    scroller.style.paddingInline = `${pad}px`;
    scrollElementIntoHorizontalView(node, {
      behavior,
      inline: "center",
      scroller,
    });
  };

  useLayoutEffect(() => {
    const key = `${selectedDate.toISOString()}:${rangeSignature}`;
    const behavior: ScrollBehavior =
      centeredKey.current && centeredKey.current !== key ? "smooth" : "auto";
    centeredKey.current = key;
    centerSelected(behavior);

    if (!scrollerNode) return;
    const observer = new ResizeObserver(() => centerSelected("auto"));
    observer.observe(scrollerNode);
    return () => observer.disconnect();
    // centerSelected closes over the latest selected day on each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, rangeSignature, scrollerNode]);

  return (
    <>
      <HeaderCalendarPortal>
        <div className="calendar-strip pb-1.5">
          <div
            ref={setScrollerNode}
            data-horizontal-scroll
            className="flex min-w-0 items-stretch gap-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        </div>
      </HeaderCalendarPortal>

      {/* Desktop: fixed 7-day window centered on selection */}
      <div className="-mx-3 hidden min-w-0 grid-cols-7 items-stretch px-6 py-1 sm:-mx-4 md:-mx-6 lg:grid">
        {desktopCells.map((item, column) =>
          item ? (
            <CalendarStripDay
              key={item.day.toISOString()}
              date={item.day}
              selected={isSameDay(item.day, selectedDate)}
              tasks={item.tasks}
              dayStatus={item.dayStatus}
              inactive={item.inactive}
              layout="grid"
              onSelect={() => onSelectDate(item.day)}
            />
          ) : (
            <div key={`calendar-pad-${column}`} aria-hidden />
          )
        )}
      </div>
    </>
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
