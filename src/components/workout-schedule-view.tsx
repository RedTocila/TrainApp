"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getScheduledCardioInRange } from "@/lib/actions/user-cardio";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { formatLocalized } from "@/lib/date-locale";
import { isExtraWorkoutKind, normalizeWorkoutPlanKind } from "@/lib/hiit";
import type { ScheduledCardio, ScheduledWorkout } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKS_BACK = 2;
const WEEKS_FORWARD = 10;

type DayPlan = {
  dateKey: string;
  date: Date;
  workouts: ScheduledWorkout[];
  cardios: ScheduledCardio[];
};

function weekMonday(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function sessionTypeLabel(
  kind: string | null | undefined,
  platform: ReturnType<typeof usePlatformCopy>
) {
  const normalized = normalizeWorkoutPlanKind(kind);
  if (normalized === "warmup") return platform.workout.sessionTypeWarmup;
  if (normalized === "stretch") return platform.workout.sessionTypeStretch;
  if (normalized === "hiit") return "HIIT";
  return platform.workout.sessionTypeMain;
}

/** Weekly schedule of planned workouts + cardio (page body). */
export function WorkoutScheduleView() {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const [weekOffset, setWeekOffset] = useState(WEEKS_BACK);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [cardios, setCardios] = useState<ScheduledCardio[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getScheduledWorkoutsInRange(rangeFrom, rangeTo),
      getScheduledCardioInRange(rangeFrom, rangeTo),
    ])
      .then(([nextWorkouts, nextCardios]) => {
        if (cancelled) return;
        setWorkouts(nextWorkouts);
        setCardios(nextCardios);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeFrom, rangeTo]);

  const days: DayPlan[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(selectedMonday, index);
      const dateKey = format(date, "yyyy-MM-dd");
      return {
        dateKey,
        date,
        workouts: workouts.filter((item) => item.scheduled_date === dateKey),
        cardios: cardios.filter((item) => item.scheduled_date === dateKey),
      };
    });
  }, [selectedMonday, workouts, cardios]);

  const weekLabel = formatLocalized(selectedMonday, "MMM d", locale);
  const rangeLabel = `${formatLocalized(selectedMonday, "MMM d", locale)} – ${formatLocalized(selectedSunday, "MMM d", locale)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          disabled={weekOffset <= 0}
          onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
          aria-label={platform.workout.previous}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-base font-black tracking-tight">{weekLabel}</p>
          <p className="truncate text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          disabled={weekOffset >= weekStarts.length - 1}
          onClick={() =>
            setWeekOffset((value) => Math.min(weekStarts.length - 1, value + 1))
          }
          aria-label={platform.common.next}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {weekStarts.map((weekStart, index) => {
          const label = formatLocalized(weekStart, "MMM d", locale);
          return (
            <button
              key={index}
              type="button"
              onClick={() => setWeekOffset(index)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                index === weekOffset
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {platform.workout.workoutPlan}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          {platform.cardio.title}
        </span>
      </div>

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
            const isToday =
              format(day.date, "yyyy-MM-dd") ===
              format(new Date(), "yyyy-MM-dd");
            const empty =
              day.workouts.length === 0 && day.cardios.length === 0;
            return (
              <li
                key={day.dateKey}
                className={cn(
                  "rounded-2xl border px-3 py-3 sm:px-4",
                  isToday
                    ? "border-primary/55 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.25)]"
                    : "border-border/50 bg-secondary/25"
                )}
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-black",
                        isToday ? "text-primary" : "text-foreground"
                      )}
                    >
                      {formatLocalized(day.date, "EEEE", locale)}
                    </p>
                    {isToday ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        {platform.calendar.today}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      isToday ? "font-semibold text-primary/80" : "text-muted-foreground"
                    )}
                  >
                    {formatLocalized(day.date, "MMM d", locale)}
                  </p>
                </div>

                {empty ? (
                  <p className="text-xs text-muted-foreground/80">
                    {platform.workout.scheduleRestDay}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {day.workouts.map((workout) => {
                      const kind = normalizeWorkoutPlanKind(
                        workout.workout_plans?.kind
                      );
                      const exerciseCount =
                        workout.workout_days?.exercises?.length ?? 0;
                      const title =
                        workout.workout_days?.title ??
                        workout.workout_plans?.title ??
                        platform.workout.workoutPlan;
                      const extra = isExtraWorkoutKind(kind);
                      const meta = [
                        sessionTypeLabel(kind, platform),
                        exerciseCount > 0
                          ? platform.common.exercises(exerciseCount)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={workout.id}>
                          <Link
                            href={`/dashboard/workout/${workout.plan_id}`}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/50 py-2.5 pl-2.5 pr-3 transition-colors hover:bg-secondary/70 active:scale-[0.99]",
                              "border-l-[3px]",
                              extra
                                ? "border-l-muted-foreground/45"
                                : "border-l-primary"
                            )}
                          >
                            <Dumbbell
                              className={cn(
                                "h-4 w-4 shrink-0",
                                extra
                                  ? "text-muted-foreground"
                                  : "text-primary"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-snug">
                                {title}
                              </p>
                              {meta ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {meta}
                                </p>
                              ) : null}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                          </Link>
                        </li>
                      );
                    })}
                    {day.cardios.map((cardio) => {
                      const duration =
                        cardio.client_cardio?.duration_minutes != null
                          ? `${cardio.client_cardio.duration_minutes} min`
                          : null;
                      return (
                        <li key={cardio.id}>
                          <Link
                            href={`/dashboard/workout/cardio/session?date=${encodeURIComponent(day.dateKey)}&cardioId=${encodeURIComponent(cardio.cardio_id)}`}
                            className="flex items-center gap-3 rounded-xl border border-border/60 border-l-[3px] border-l-orange-500 bg-secondary/50 py-2.5 pl-2.5 pr-3 transition-colors hover:bg-secondary/70 active:scale-[0.99]"
                          >
                            <HeartPulse className="h-4 w-4 shrink-0 text-orange-400" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-snug">
                                {cardio.client_cardio?.title ??
                                  platform.cardio.title}
                              </p>
                              {duration ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {duration}
                                </p>
                              ) : null}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
