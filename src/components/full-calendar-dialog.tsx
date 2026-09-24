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
  max as maxDate,
  startOfMonth,
  startOfDay,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Button } from "@/components/ui/button";
import { WorkoutScheduleView } from "@/components/workout-schedule-view";
import { fetchFullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";
import { formatLocalized } from "@/lib/date-locale";
import {
  getCachedFullCalendarMonth,
  hasCachedFullCalendarMonth,
  listCachedFullCalendarMonths,
  setCachedFullCalendarMonth,
} from "@/lib/full-calendar-cache";
import {
  mergeCalendarEnrichment,
  mergeCalendarSchedule,
} from "@/lib/full-calendar-merge";
import type { ClientSchedule } from "@/lib/daily-tasks";
import {
  enrichTasksForDate,
  getCalendarDayStatus,
  type DashboardEnrichmentData,
} from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

/** Month grid slide — keep in sync with touch settle timing below. */
const MONTH_SLIDE_MS = 280;
const MONTH_SWIPE_THRESHOLD_PX = 48;
const MONTH_SWIPE_VELOCITY = 0.35;
const MONTH_AXIS_LOCK_PX = 8;

interface FullCalendarDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}

function monthRangeKeys(viewMonth: Date): {
  from: string;
  to: string;
  cacheKey: string;
} {
  const start = startOfWeek(startOfMonth(viewMonth));
  const end = endOfWeek(endOfMonth(viewMonth));
  const from = format(start, "yyyy-MM-dd");
  const to = format(end, "yyyy-MM-dd");
  return { from, to, cacheKey: `${from}:${to}` };
}

function applyCachedSlices(
  schedule: ClientSchedule,
  enrichment: DashboardEnrichmentData
): { schedule: ClientSchedule; enrichment: DashboardEnrichmentData } {
  let nextSchedule = schedule;
  let nextEnrichment = enrichment;
  for (const slice of listCachedFullCalendarMonths()) {
    nextEnrichment = mergeCalendarEnrichment(nextEnrichment, slice.enrichment);
    nextSchedule = mergeCalendarSchedule(nextSchedule, slice.scheduleSlice);
  }
  return { schedule: nextSchedule, enrichment: nextEnrichment };
}

export function FullCalendarDialog({
  open,
  onClose,
  selectedDate,
  onSelectDate,
  schedule: initialSchedule,
  enrichment: initialEnrichment,
}: FullCalendarDialogProps) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const [viewMode, setViewMode] = useState<"month" | "weeks">("month");
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(initialSchedule);
  const [enrichment, setEnrichment] = useState(initialEnrichment);
  /** Only spin when navigating into a month we have never loaded. */
  const [loadingMonth, setLoadingMonth] = useState(false);
  const loadedRangesRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  const loadingKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const activeFrom = useMemo(() => {
    if (!enrichment.accountCreatedAt) return null;
    const d = new Date(enrichment.accountCreatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return startOfDay(d);
  }, [enrichment.accountCreatedAt]);

  const earliestMonth = useMemo(() => {
    if (!activeFrom) return null;
    return startOfMonth(activeFrom);
  }, [activeFrom]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Seed from dashboard + any cached month slices when the dialog opens.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setViewMode("month");
      setViewMonth(startOfMonth(selectedDate));
      const seeded = applyCachedSlices(initialSchedule, initialEnrichment);
      setSchedule(seeded.schedule);
      setEnrichment(seeded.enrichment);
      loadedRangesRef.current = new Set(
        listCachedFullCalendarMonths().map((s) => `${s.from}:${s.to}`)
      );
      setLoadingMonth(false);
    }
    wasOpenRef.current = open;
  }, [open, selectedDate, initialSchedule, initialEnrichment]);

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

  const loadMonth = useCallback(
    (month: Date, opts: { showSpinner: boolean; preferCache: boolean }) => {
      const { from, to, cacheKey } = monthRangeKeys(month);

      if (opts.preferCache) {
        const cached = getCachedFullCalendarMonth(cacheKey);
        if (cached) {
          loadedRangesRef.current.add(cacheKey);
          setEnrichment((prev) =>
            mergeCalendarEnrichment(prev, cached.enrichment)
          );
          setSchedule((prev) =>
            mergeCalendarSchedule(prev, cached.scheduleSlice)
          );
          return Promise.resolve();
        }
      }

      if (loadedRangesRef.current.has(cacheKey)) {
        return Promise.resolve();
      }

      const existing = inflightRef.current.get(cacheKey);
      if (existing) return existing;

      if (opts.showSpinner) {
        loadingKeyRef.current = cacheKey;
        setLoadingMonth(true);
      }

      const timezoneOffsetMinutes = new Date().getTimezoneOffset();
      const request = fetchFullCalendarMonthSlice(
        from,
        to,
        timezoneOffsetMinutes
      )
        .then((result) => {
          if ("error" in result) {
            console.error("[full-calendar]", result.error);
            return;
          }
          setCachedFullCalendarMonth(cacheKey, result);
          loadedRangesRef.current.add(cacheKey);
          setEnrichment((prev) =>
            mergeCalendarEnrichment(prev, result.enrichment)
          );
          setSchedule((prev) =>
            mergeCalendarSchedule(prev, result.scheduleSlice)
          );
        })
        .catch((err) => {
          console.error("[full-calendar]", err);
        })
        .finally(() => {
          inflightRef.current.delete(cacheKey);
          if (loadingKeyRef.current === cacheKey) {
            loadingKeyRef.current = null;
            setLoadingMonth(false);
          }
        });

      inflightRef.current.set(cacheKey, request);
      return request;
    },
    []
  );

  // Current month: open instantly from seed/cache; refresh quietly in background.
  // Other months: use cache if present, otherwise fetch (with a light spinner).
  useEffect(() => {
    if (!open) return;

    const { cacheKey } = monthRangeKeys(viewMonth);
    const cached = hasCachedFullCalendarMonth(cacheKey);
    const alreadyLoaded = loadedRangesRef.current.has(cacheKey);

    if (cached && !alreadyLoaded) {
      void loadMonth(viewMonth, { showSpinner: false, preferCache: true });
    } else if (!alreadyLoaded && !cached) {
      // First paint already has dashboard ±14d data — don't block the UI.
      const isOpeningMonth = isSameMonth(viewMonth, selectedDate);
      void loadMonth(viewMonth, {
        showSpinner: !isOpeningMonth,
        preferCache: false,
      });
    }

    // Warm neighbors so back/forth feels instant.
    const prev = subMonths(viewMonth, 1);
    const next = addMonths(viewMonth, 1);
    const warm = window.setTimeout(() => {
      void loadMonth(prev, { showSpinner: false, preferCache: true });
      void loadMonth(next, { showSpinner: false, preferCache: true });
    }, 150);

    return () => window.clearTimeout(warm);
  }, [open, viewMonth, selectedDate, loadMonth]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const dayCells = useMemo(() => {
    return monthDays.map((day) => {
      const rawTasks = enrichTasksForDate(day, schedule, enrichment, now);
      const beforeActive = activeFrom ? isBefore(day, activeFrom) : false;
      const tasks = beforeActive ? [] : rawTasks;
      return {
        day,
        tasks,
        dayStatus: getCalendarDayStatus(tasks, day, now),
        beforeActive,
        selected: isSameDay(day, selectedDate),
        inMonth: isSameMonth(day, viewMonth),
      };
    });
  }, [monthDays, schedule, enrichment, now, activeFrom, selectedDate, viewMonth]);

  const selectedDayTasks = useMemo(() => {
    const raw = enrichTasksForDate(selectedDate, schedule, enrichment, now);
    if (activeFrom && isBefore(selectedDate, activeFrom)) return [];
    return raw;
  }, [selectedDate, schedule, enrichment, now, activeFrom]);
  const { active, completed, missed } = useMemo(
    () => groupTasksByStatus(selectedDayTasks),
    [selectedDayTasks]
  );
  const beforeAccount =
    activeFrom != null && isBefore(selectedDate, activeFrom);

  const canGoPrev =
    !earliestMonth || isBefore(earliestMonth, startOfMonth(viewMonth));
  const canGoNext = true;

  const monthSlideRef = useRef<HTMLDivElement>(null);
  const [monthSlideMounted, setMonthSlideMounted] = useState(false);
  const monthAnimatingRef = useRef(false);
  const canGoPrevRef = useRef(canGoPrev);
  const earliestMonthRef = useRef(earliestMonth);
  canGoPrevRef.current = canGoPrev;
  earliestMonthRef.current = earliestMonth;

  const setMonthSlideNode = useCallback((node: HTMLDivElement | null) => {
    monthSlideRef.current = node;
    setMonthSlideMounted(Boolean(node));
  }, []);

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const setMonthOffset = useCallback((x: number, animate: boolean) => {
    const el = monthSlideRef.current;
    if (!el) return;
    if (animate && !prefersReducedMotion()) {
      el.style.transition = `transform ${MONTH_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    } else {
      el.style.transition = "none";
    }
    el.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
  }, [prefersReducedMotion]);

  const applyMonthDelta = useCallback((delta: 1 | -1) => {
    setViewMonth((m) => {
      if (delta === 1) return addMonths(m, 1);
      const prev = subMonths(m, 1);
      const earliest = earliestMonthRef.current;
      if (!earliest) return prev;
      return maxDate([prev, earliest]);
    });
  }, []);

  const navigateMonth = useCallback(
    (delta: 1 | -1) => {
      if (delta === -1 && !canGoPrevRef.current) return;
      if (monthAnimatingRef.current) return;

      if (prefersReducedMotion()) {
        setMonthOffset(0, false);
        applyMonthDelta(delta);
        return;
      }

      const el = monthSlideRef.current;
      const width = el?.offsetWidth ?? 320;
      monthAnimatingRef.current = true;
      setMonthOffset(-delta * width, true);

      window.setTimeout(() => {
        applyMonthDelta(delta);
        setMonthOffset(delta * width, false);
        // Double rAF so the enter offset paints before sliding to rest.
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setMonthOffset(0, true);
            window.setTimeout(() => {
              monthAnimatingRef.current = false;
              const node = monthSlideRef.current;
              if (node) node.style.transition = "";
            }, MONTH_SLIDE_MS + 20);
          });
        });
      }, MONTH_SLIDE_MS);
    },
    [applyMonthDelta, prefersReducedMotion, setMonthOffset]
  );

  // Horizontal swipe between months (fullscreen page — no drawer pull conflict).
  useEffect(() => {
    if (!open || viewMode !== "month") return;
    const root = monthSlideRef.current;
    if (!root) return;

    const touch = {
      startX: 0,
      startY: 0,
      lastX: 0,
      lastTs: 0,
      velocity: 0,
      axis: null as null | "h" | "v",
      active: false,
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || monthAnimatingRef.current) return;
      const t = event.touches[0];
      if (!t) return;
      touch.startX = t.clientX;
      touch.startY = t.clientY;
      touch.lastX = t.clientX;
      touch.lastTs = event.timeStamp;
      touch.velocity = 0;
      touch.axis = null;
      touch.active = true;
      setMonthOffset(0, false);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!touch.active || event.touches.length !== 1) return;
      const t = event.touches[0];
      if (!t) return;
      const dx = t.clientX - touch.startX;
      const dy = t.clientY - touch.startY;
      const dt = Math.max(1, event.timeStamp - touch.lastTs);
      touch.velocity = (t.clientX - touch.lastX) / dt;
      touch.lastX = t.clientX;
      touch.lastTs = event.timeStamp;

      if (!touch.axis) {
        if (Math.abs(dx) < MONTH_AXIS_LOCK_PX && Math.abs(dy) < MONTH_AXIS_LOCK_PX) {
          return;
        }
        // Prefer horizontal when movement is clearly sideways.
        touch.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
        if (touch.axis === "v") {
          touch.active = false;
          return;
        }
      }

      if (touch.axis !== "h") return;

      // Resist past the earliest month edge.
      let resisted = dx;
      if (dx > 0 && !canGoPrevRef.current) {
        resisted = dx * 0.28;
      }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      setMonthOffset(resisted, false);
    };

    const finishSwipe = () => {
      if (!touch.active) return;
      const wasHorizontal = touch.axis === "h";
      touch.active = false;
      if (!wasHorizontal) return;

      const dx = touch.lastX - touch.startX;
      const fastLeft = touch.velocity < -MONTH_SWIPE_VELOCITY;
      const fastRight = touch.velocity > MONTH_SWIPE_VELOCITY;
      const goNext = dx <= -MONTH_SWIPE_THRESHOLD_PX || fastLeft;
      const goPrev =
        (dx >= MONTH_SWIPE_THRESHOLD_PX || fastRight) && canGoPrevRef.current;

      if (goNext) {
        navigateMonth(1);
        return;
      }
      if (goPrev) {
        navigateMonth(-1);
        return;
      }

      setMonthOffset(0, true);
      window.setTimeout(() => {
        const node = monthSlideRef.current;
        if (node) node.style.transition = "";
      }, MONTH_SLIDE_MS + 20);
    };

    // Capture phase so month swipe wins over nested controls / scroll parents.
    root.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    root.addEventListener("touchend", finishSwipe, { capture: true });
    root.addEventListener("touchcancel", finishSwipe, { capture: true });

    return () => {
      root.removeEventListener("touchstart", onTouchStart, true);
      root.removeEventListener("touchmove", onTouchMove, true);
      root.removeEventListener("touchend", finishSwipe, true);
      root.removeEventListener("touchcancel", finishSwipe, true);
    };
  }, [open, viewMode, monthSlideMounted, navigateMonth, setMonthOffset]);

  // Keep mounted while open=false so AppOverlay can play exit animation.
  return (
    <AppOverlay open={open} onClose={onClose} fullscreen>
      <AppOverlayPanel
        fullscreen
        showHandle={false}
        aria-label={platform.calendar.fullCalendarTitle}
        className="bg-background"
      >
        <header className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-[max(0.75rem,var(--safe-area-top))]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            aria-label={platform.calendar.closeCalendar}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CalendarDays className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h2 className="min-w-0 flex-1 truncate text-lg font-black leading-tight">
            {platform.calendar.fullCalendarTitle}
          </h2>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1rem,var(--safe-area-bottom))]"
          data-scroll-lock-scrollable
        >
          <div className="mx-auto w-full max-w-4xl">
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              aria-label={platform.calendar.viewModeAria}
              className="mb-5"
              options={[
                { value: "month", label: platform.calendar.viewMonth },
                { value: "weeks", label: platform.calendar.viewWeeks },
              ]}
            />

            {viewMode === "weeks" ? (
              <WorkoutScheduleView
                onNavigate={onClose}
                schedule={schedule}
                enrichment={enrichment}
              />
            ) : (
              <>
                <div className="overflow-hidden">
                  <div
                    ref={setMonthSlideNode}
                    className="touch-pan-y will-change-transform"
                    style={{ touchAction: "pan-y" }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!canGoPrev}
                        onClick={() => navigateMonth(-1)}
                        aria-label={platform.calendar.previousMonth}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black tracking-tight">
                          {formatLocalized(viewMonth, "MMMM yyyy", locale)}
                        </h3>
                        {loadingMonth ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-muted-foreground"
                            aria-label={platform.common.loading}
                          />
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!canGoNext}
                        onClick={() => navigateMonth(1)}
                        aria-label={platform.calendar.nextMonth}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div
                      className={cn(
                        "grid grid-cols-7 gap-1.5 transition-opacity",
                        loadingMonth && "opacity-60"
                      )}
                    >
                      {dayCells.map(
                        ({
                          day,
                          tasks,
                          dayStatus,
                          beforeActive,
                          selected,
                          inMonth,
                        }) => (
                          <div
                            key={day.toISOString()}
                            className={cn(!inMonth && "opacity-35")}
                          >
                            <CalendarDayDot
                              date={day}
                              tasks={tasks}
                              dayStatus={dayStatus}
                              inactive={beforeActive}
                              now={now}
                              selected={selected}
                              onSelect={() => {
                                onSelectDate(day);
                              }}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold">
                      {formatLocalized(selectedDate, "EEEE, MMMM d", locale)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {beforeAccount
                        ? platform.calendar.noActivityYet
                        : platform.calendar.daySummary(
                            active.length,
                            completed.length,
                            missed.length
                          )}
                    </p>
                  </div>
                  {beforeAccount ? null : (
                    <DayTasksList tasks={selectedDayTasks} onTaskClick={onClose} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
