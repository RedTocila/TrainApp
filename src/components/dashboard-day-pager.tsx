"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { addDays, format, startOfDay } from "date-fns";
import {
  DayPageDateProvider,
  useSelectedDate,
} from "@/components/date-provider";
import { formatDateKey, cn } from "@/lib/utils";

function dayBounds(accountCreatedAt: string | null | undefined) {
  const today = startOfDay(new Date());
  const start = accountCreatedAt
    ? startOfDay(new Date(accountCreatedAt))
    : addDays(today, -3);
  const end = addDays(today, 28);
  return { start, end };
}

function clampDay(date: Date, start: Date, end: Date): Date {
  if (date < start) return start;
  if (date > end) return end;
  return date;
}

/**
 * Horizontal day carousel: swipe left/right to change days.
 * Vertical scroll is on `.dashboard-main` so the header + calendar scroll away.
 */
export function DashboardDayPager({
  accountCreatedAt,
  children,
}: {
  accountCreatedAt?: string | null;
  children: () => ReactNode;
}) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const { start, end } = useMemo(
    () => dayBounds(accountCreatedAt),
    [accountCreatedAt]
  );

  const selected = useMemo(
    () => clampDay(startOfDay(selectedDate), start, end),
    [selectedDate, start, end]
  );
  const selectedKey = formatDateKey(selected);

  const pages = useMemo(() => {
    const prev = addDays(selected, -1);
    const next = addDays(selected, 1);
    const list: Date[] = [];
    if (prev >= start) list.push(prev);
    list.push(selected);
    if (next <= end) list.push(next);
    return list;
  }, [selected, start, end]);

  const selectedPageIndex = pages.findIndex(
    (d) => formatDateKey(d) === selectedKey
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const settleTimerRef = useRef(0);

  const scrollToPageIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const scroller = scrollerRef.current;
      if (!scroller || index < 0) return;
      const width = scroller.clientWidth;
      if (width <= 0) return;
      programmaticScrollRef.current = true;
      scroller.scrollTo({ left: index * width, behavior });
      window.setTimeout(
        () => {
          programmaticScrollRef.current = false;
        },
        behavior === "smooth" ? 420 : 40
      );
    },
    []
  );

  useLayoutEffect(() => {
    scrollToPageIndex(selectedPageIndex, "auto");
  }, [selectedKey, selectedPageIndex, pages.length, scrollToPageIndex]);

  const commitFromScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const width = scroller.clientWidth;
    if (width <= 0) return;
    const index = Math.round(scroller.scrollLeft / width);
    const day = pages[index];
    if (!day) return;
    if (formatDateKey(day) === selectedKey) {
      scrollToPageIndex(index, "smooth");
      return;
    }
    setSelectedDate(day);
  }, [pages, selectedKey, setSelectedDate, scrollToPageIndex]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      if (programmaticScrollRef.current) return;
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(commitFromScroll, 90);
    };

    const onScrollEnd = () => {
      window.clearTimeout(settleTimerRef.current);
      commitFromScroll();
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", onScrollEnd);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", onScrollEnd);
      window.clearTimeout(settleTimerRef.current);
    };
  }, [commitFromScroll]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onResize = () => scrollToPageIndex(selectedPageIndex, "auto");
    const observer = new ResizeObserver(onResize);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [selectedPageIndex, scrollToPageIndex]);

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "dashboard-day-pager -mx-3 flex snap-x snap-mandatory overflow-x-auto overflow-y-visible overscroll-x-contain sm:-mx-4 md:-mx-6",
        // Extend into the floating-nav safe area so themed cards show through the pill.
        "-mb-[var(--dashboard-mobile-nav-height,4.25rem)]",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Daily dashboard"
    >
      {pages.map((day) => {
        const key = formatDateKey(day);
        return (
          <section
            key={key}
            data-date-key={key}
            className={cn(
              "dashboard-day-page flex w-full min-w-full shrink-0 snap-start snap-always flex-col",
              "px-3 sm:px-4 md:px-6",
              "pb-[var(--dashboard-mobile-nav-height,4.25rem)]"
            )}
            aria-label={format(day, "EEEE, MMMM d")}
          >
            <DayPageDateProvider date={day}>
              <div className="flex flex-1 flex-col gap-3 py-3 sm:gap-4 sm:py-4">
                {children()}
              </div>
            </DayPageDateProvider>
          </section>
        );
      })}
    </div>
  );
}
