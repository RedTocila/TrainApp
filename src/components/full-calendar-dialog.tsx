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
import { useEffect, useMemo, useRef, useState } from "react";
import { AppDrawerHeader } from "@/components/app-dialog";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { fetchFullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";
import { formatLocalized } from "@/lib/date-locale";
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

function monthRangeKeys(viewMonth: Date): { from: string; to: string; cacheKey: string } {
  const start = startOfWeek(startOfMonth(viewMonth));
  const end = endOfWeek(endOfMonth(viewMonth));
  const from = format(start, "yyyy-MM-dd");
  const to = format(end, "yyyy-MM-dd");
  return { from, to, cacheKey: `${from}:${to}` };
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
  const [loadingMonth, setLoadingMonth] = useState(false);
  const loadedRangesRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<string | null>(null);
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

  // Seed from dashboard data only when the dialog opens (not on every enrichment tick).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setViewMonth(startOfMonth(selectedDate));
      setSchedule(initialSchedule);
      setEnrichment(initialEnrichment);
      loadedRangesRef.current = new Set();
      inflightRef.current = null;
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

  // Lazy-load completions + schedule for the visible month grid.
  useEffect(() => {
    if (!open) return;

    const { from, to, cacheKey } = monthRangeKeys(viewMonth);
    if (loadedRangesRef.current.has(cacheKey)) {
      setLoadingMonth(false);
      return;
    }

    let cancelled = false;
    inflightRef.current = cacheKey;
    setLoadingMonth(true);

    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    void fetchFullCalendarMonthSlice(from, to, timezoneOffsetMinutes)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          console.error("[full-calendar]", result.error);
          return;
        }
        loadedRangesRef.current.add(cacheKey);
        setEnrichment((prev) => mergeCalendarEnrichment(prev, result.enrichment));
        setSchedule((prev) => mergeCalendarSchedule(prev, result.scheduleSlice));
      })
      .catch((err) => {
        if (!cancelled) console.error("[full-calendar]", err);
      })
      .finally(() => {
        if (inflightRef.current === cacheKey) {
          inflightRef.current = null;
        }
        if (!cancelled) {
          setLoadingMonth(false);
        }
      });

    return () => {
      cancelled = true;
      // Allow a remount (Strict Mode) to start a fresh request for the same month.
      if (inflightRef.current === cacheKey) {
        inflightRef.current = null;
      }
    };
  }, [open, viewMonth]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

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
              disabled={!canGoPrev || loadingMonth}
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
              disabled={!canGoNext || loadingMonth}
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label={platform.calendar.nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />{" "}
              {platform.calendar.completionFailed}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />{" "}
              {platform.calendar.completionSuccess}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />{" "}
              {platform.calendar.completionNeutral}
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

          <div
            className={cn(
              "grid grid-cols-7 gap-1.5 transition-opacity",
              loadingMonth && "opacity-60"
            )}
          >
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
                    inactive={beforeActive}
                    now={now}
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
              <DayTasksList
                tasks={selectedDayTasks}
                onTaskClick={onClose}
              />
            )}
          </div>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
