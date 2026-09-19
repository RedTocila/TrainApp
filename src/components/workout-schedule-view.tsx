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
import { Badge } from "@/components/ui/badge";
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

  const relativeWeek = weekOffset - WEEKS_BACK + 1;
  const weekLabel =
    relativeWeek >= 1
      ? platform.workout.scheduleWeek(relativeWeek)
      : formatLocalized(selectedMonday, "MMM d", locale);
  const rangeLabel = `${formatLocalized(selectedMonday, "MMM d", locale)} – ${formatLocalized(selectedSunday, "MMM d", locale)}`;

  return (
    <div className="space-y-4">
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
          <p className="text-sm font-bold">{weekLabel}</p>
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

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {weekStarts.map((_, index) => {
          const weekNum = index - WEEKS_BACK + 1;
          const label =
            weekNum >= 1
              ? platform.workout.scheduleWeek(weekNum)
              : formatLocalized(weekStarts[index], "MMM d", locale);
          return (
            <button
              key={index}
              type="button"
              onClick={() => setWeekOffset(index)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                index === weekOffset
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-2xl bg-secondary/60"
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
                  "rounded-2xl border border-border/50 bg-secondary/30 p-3",
                  isToday && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {formatLocalized(day.date, "EEEE", locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatLocalized(day.date, "MMM d", locale)}
                    {isToday ? ` · ${platform.calendar.today}` : ""}
                  </p>
                </div>

                {empty ? (
                  <p className="text-xs text-muted-foreground">
                    {platform.workout.scheduleRestDay}
                  </p>
                ) : (
                  <div className="space-y-1.5">
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
                      return (
                        <Link
                          key={workout.id}
                          href={`/dashboard/workout/${workout.plan_id}`}
                          className="flex items-start gap-2 rounded-xl bg-background/50 px-2.5 py-2 transition-colors hover:bg-background hover:ring-1 hover:ring-primary/30 active:scale-[0.99]"
                        >
                          <Dumbbell
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              isExtraWorkoutKind(kind)
                                ? "text-muted-foreground"
                                : "text-primary"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant="secondary"
                                className="h-5 px-1.5 text-[10px]"
                              >
                                {sessionTypeLabel(kind, platform)}
                              </Badge>
                              {exerciseCount > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px]"
                                >
                                  {platform.common.exercises(exerciseCount)}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      );
                    })}
                    {day.cardios.map((cardio) => (
                      <Link
                        key={cardio.id}
                        href={`/dashboard/workout/cardio/session?date=${encodeURIComponent(day.dateKey)}&cardioId=${encodeURIComponent(cardio.cardio_id)}`}
                        className="flex items-start gap-2 rounded-xl bg-background/50 px-2.5 py-2 transition-colors hover:bg-background hover:ring-1 hover:ring-rose-400/30 active:scale-[0.99]"
                      >
                        <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {cardio.client_cardio?.title ??
                              platform.cardio.title}
                          </p>
                          {cardio.client_cardio?.duration_minutes != null ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {cardio.client_cardio.duration_minutes} min
                            </p>
                          ) : null}
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
