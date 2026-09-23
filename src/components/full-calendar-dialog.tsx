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
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppDrawerHeader } from "@/components/app-dialog";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
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
  const weekdays = useMemo(() => getSundayFirstWeekdayLabels(locale), [locale]);
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

  if (!open) return null;

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel
        maxWidth="max-w-4xl"
        aria-label={platform.calendar.fullCalendarTitle}
        className="max-h-[92%]"
      >
        <AppDrawerHeader
          title={platform.calendar.fullCalendarTitle}
          description={platform.calendar.tapDayHint}
        />

        <div className="overflow-y-auto px-5 pt-5 pb-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoPrev}
              onClick={() =>
                setViewMonth((m) => {
                  const prev = subMonths(m, 1);
                  if (!earliestMonth) return prev;
                  return maxDate([prev, earliestMonth]);
                })
              }
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
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
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
              ({ day, tasks, dayStatus, beforeActive, selected, inMonth }) => (
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
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
