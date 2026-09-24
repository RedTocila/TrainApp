"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { Button } from "@/components/ui/button";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { fetchFullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";
import type { ClientSchedule } from "@/lib/daily-tasks";
import {
  enrichTasksForDate,
  type DashboardEnrichmentData,
} from "@/lib/dashboard-task-enrichment";
import { formatLocalized } from "@/lib/date-locale";
import {
  mergeCalendarEnrichment,
  mergeCalendarSchedule,
} from "@/lib/full-calendar-merge";
import { scrollElementIntoHorizontalView } from "@/lib/scroll-horizontal";
import { formatDateKey, cn } from "@/lib/utils";

const WEEKS_BACK = 2;
const WEEKS_FORWARD = 10;
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 420;
const EASE = [0.22, 1, 0.36, 1] as const;

function weekMonday(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function todayKey() {
  return formatDateKey(new Date());
}

/** Weekly schedule: workout / nutrition / cardio / water / habits (no warm-up or stretch). */
export function WorkoutScheduleView({
  onNavigate,
  schedule: initialSchedule,
  enrichment: initialEnrichment,
}: {
  /** Called when the user opens a task (e.g. close an overlay). */
  onNavigate?: () => void;
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [weekOffset, setWeekOffset] = useState(WEEKS_BACK);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [enrichment, setEnrichment] = useState(initialEnrichment);
  const [openDateKey, setOpenDateKey] = useState<string | null>(() => todayKey());
  const directionRef = useRef(0);
  const weekChipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const weekStripRef = useRef<HTMLDivElement>(null);
  const loadedRangeRef = useRef<string | null>(null);

  const weekStarts = useMemo(() => {
    const origin = weekMonday(new Date());
    return Array.from({ length: WEEKS_BACK + WEEKS_FORWARD + 1 }, (_, index) =>
      addWeeks(origin, index - WEEKS_BACK)
    );
  }, []);

  const selectedMonday = weekStarts[weekOffset] ?? weekStarts[WEEKS_BACK];
  const selectedSunday = addDays(selectedMonday, 6);
  const rangeFrom = format(weekStarts[0], "yyyy-MM-dd");
  const rangeTo = format(
    addDays(weekStarts[weekStarts.length - 1], 6),
    "yyyy-MM-dd"
  );

  const goToWeek = useCallback(
    (next: number) => {
      const clamped = Math.min(weekStarts.length - 1, Math.max(0, next));
      if (clamped === weekOffset) return;
      directionRef.current = clamped > weekOffset ? 1 : -1;
      setWeekOffset(clamped);
    },
    [weekOffset, weekStarts.length]
  );

  // Seed from parent when it updates (month loads in the calendar).
  useEffect(() => {
    setSchedule((prev) => ({
      ...initialSchedule,
      scheduledWorkouts: [
        ...new Map(
          [
            ...(prev.scheduledWorkouts ?? []),
            ...(initialSchedule.scheduledWorkouts ?? []),
          ].map((w) => [w.id, w])
        ).values(),
      ],
      scheduledNutritionDays: [
        ...new Map(
          [
            ...(prev.scheduledNutritionDays ?? []),
            ...(initialSchedule.scheduledNutritionDays ?? []),
          ].map((n) => [n.id, n])
        ).values(),
      ],
      scheduledCardioByDate: {
        ...(prev.scheduledCardioByDate ?? {}),
        ...(initialSchedule.scheduledCardioByDate ?? {}),
      },
      habitsByDate: {
        ...(prev.habitsByDate ?? {}),
        ...(initialSchedule.habitsByDate ?? {}),
      },
    }));
    setEnrichment((prev) => mergeCalendarEnrichment(prev, initialEnrichment));
  }, [initialSchedule, initialEnrichment]);

  useEffect(() => {
    const cacheKey = `${rangeFrom}:${rangeTo}`;
    if (loadedRangeRef.current === cacheKey) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    void fetchFullCalendarMonthSlice(rangeFrom, rangeTo, timezoneOffsetMinutes)
      .then((result) => {
        if (cancelled || "error" in result) return;
        loadedRangeRef.current = cacheKey;
        setSchedule((prev) => mergeCalendarSchedule(prev, result.scheduleSlice));
        setEnrichment((prev) =>
          mergeCalendarEnrichment(prev, result.enrichment)
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    const chip = weekChipRefs.current[weekOffset];
    if (!chip) return;
    scrollElementIntoHorizontalView(chip, {
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "center",
      scroller: weekStripRef.current,
    });
  }, [weekOffset, reduceMotion]);

  // When changing weeks, only today stays open (if it's in this week).
  useEffect(() => {
    const today = todayKey();
    const inWeek = Array.from({ length: 7 }, (_, i) =>
      formatDateKey(addDays(selectedMonday, i))
    ).includes(today);
    setOpenDateKey(inWeek ? today : null);
  }, [selectedMonday]);

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(selectedMonday, index);
      const dateKey = formatDateKey(date);
      const tasks = enrichTasksForDate(date, schedule, enrichment, now);
      return { dateKey, date, tasks };
    });
  }, [selectedMonday, schedule, enrichment]);

  const weekLabel = formatLocalized(selectedMonday, "MMM d", locale);
  const rangeLabel = `${formatLocalized(selectedMonday, "MMM d", locale)} – ${formatLocalized(selectedSunday, "MMM d", locale)}`;

  const slideVariants = {
    enter: (direction: number) => ({
      x: reduceMotion ? 0 : direction > 0 ? 56 : -56,
      opacity: reduceMotion ? 1 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: reduceMotion ? 0 : direction > 0 ? -40 : 40,
      opacity: reduceMotion ? 1 : 0,
    }),
  };

  const toggleDay = (dateKey: string) => {
    setOpenDateKey((current) => (current === dateKey ? null : dateKey));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          disabled={weekOffset <= 0}
          onClick={() => goToWeek(weekOffset - 1)}
          aria-label={platform.workout.previous}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="relative min-w-0 flex-1 overflow-hidden text-center">
          <AnimatePresence mode="wait" custom={directionRef.current} initial={false}>
            <motion.div
              key={weekOffset}
              custom={directionRef.current}
              initial="enter"
              animate="center"
              exit="exit"
              variants={slideVariants}
              transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: EASE }}
            >
              <p className="text-base font-black tracking-tight">{weekLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{rangeLabel}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          disabled={weekOffset >= weekStarts.length - 1}
          onClick={() => goToWeek(weekOffset + 1)}
          aria-label={platform.common.next}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={weekStripRef}
        data-horizontal-scroll
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {weekStarts.map((weekStart, index) => {
          const label = formatLocalized(weekStart, "MMM d", locale);
          const selected = index === weekOffset;
          return (
            <button
              key={index}
              ref={(node) => {
                weekChipRefs.current[index] = node;
              }}
              type="button"
              onClick={() => goToWeek(index)}
              className={cn(
                "relative shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                selected
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {selected && !reduceMotion ? (
                <motion.span
                  layoutId="schedule-week-pill"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : selected ? (
                <span className="absolute inset-0 rounded-full bg-primary" />
              ) : null}
              <span className="relative z-[1]">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="touch-pan-y">
        <AnimatePresence mode="wait" custom={directionRef.current} initial={false}>
          <motion.div
            key={weekOffset}
            custom={directionRef.current}
            initial="enter"
            animate="center"
            exit="exit"
            variants={slideVariants}
            transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: EASE }}
            drag={reduceMotion ? false : "x"}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              const { offset, velocity } = info;
              if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) {
                goToWeek(weekOffset + 1);
                return;
              }
              if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) {
                goToWeek(weekOffset - 1);
              }
            }}
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-xl bg-secondary/50"
                  />
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {days.map((day) => {
                  const dayIsToday = isToday(day.date);
                  const open = openDateKey === day.dateKey;
                  const { completed } = groupTasksByStatus(day.tasks);
                  const taskCount = day.tasks.length;
                  const summary =
                    taskCount === 0
                      ? platform.workout.scheduleRestDay
                      : platform.common.completedCount(
                          completed.length,
                          taskCount
                        );

                  return (
                    <li
                      key={day.dateKey}
                      className={cn(
                        "overflow-hidden rounded-2xl border",
                        dayIsToday
                          ? "border-primary/55 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.25)]"
                          : "border-border/50 bg-secondary/25"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDay(day.dateKey)}
                        aria-expanded={open}
                        aria-controls={`week-day-${day.dateKey}`}
                        className="flex w-full items-center gap-2 px-3 py-3 text-left sm:px-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "text-sm font-black",
                                dayIsToday ? "text-primary" : "text-foreground"
                              )}
                            >
                              {formatLocalized(day.date, "EEEE", locale)}
                            </p>
                            {dayIsToday ? (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                                {platform.calendar.today}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "text-xs tabular-nums",
                                dayIsToday
                                  ? "font-semibold text-primary/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {formatLocalized(day.date, "MMM d", locale)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {summary}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            open && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </button>

                      {open ? (
                        <div
                          id={`week-day-${day.dateKey}`}
                          className="border-t border-border/50 px-3 pb-3 pt-2 sm:px-4"
                        >
                          {taskCount === 0 ? (
                            <p className="text-xs text-muted-foreground/80">
                              {platform.workout.scheduleRestDay}
                            </p>
                          ) : (
                            <DayTasksList
                              tasks={day.tasks}
                              macroTargets={schedule.macroTargets}
                              dailyMeals={
                                enrichment.mealsByDate[day.dateKey] ?? []
                              }
                              waterMl={enrichment.waterByDate[day.dateKey] ?? 0}
                              waterGoalMl={schedule.waterGoalMl ?? 2500}
                              dateKey={day.dateKey}
                              onTaskClick={onNavigate}
                            />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
