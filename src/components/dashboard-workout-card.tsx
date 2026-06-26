"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday, isTomorrow } from "date-fns";
import { Check, Dumbbell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
import {
  resolveWorkoutForDate,
  isWorkoutCompletedOnDate,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  isDeadlinePassed,
  WORKOUT_DEADLINE,
} from "@/lib/meal-times";
import { cn } from "@/lib/utils";

function workoutTitle(date: Date, platform: ReturnType<typeof usePlatformCopy>) {
  if (isToday(date)) return platform.dashboard.todaysWorkout;
  if (isTomorrow(date)) return platform.dashboard.tomorrowsWorkout;
  return platform.dashboard.workoutOnDay(format(date, "EEEE"));
}

export function DashboardWorkoutCard({
  clientId,
  initialWorkout,
  initialWorkoutCompleted = false,
}: {
  clientId: string;
  initialWorkout: TodaysWorkoutInfo | null;
  initialWorkoutCompleted?: boolean;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version } = useDashboardSync();
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(
    initialWorkoutCompleted
  );

  // Sync SSR props only when the server revalidates — not when the calendar day rolls over.
  useEffect(() => {
    setWorkout(initialWorkout);
    setWorkoutCompleted(initialWorkoutCompleted);
  }, [initialWorkout, initialWorkoutCompleted]);

  const refreshWorkout = useCallback(() => {
    const dateKey = formatDateKey(selectedDate);
    return Promise.all([
      resolveWorkoutForDate(clientId, dateKey),
      isWorkoutCompletedOnDate(clientId, dateKey),
    ]);
  }, [clientId, selectedDate]);

  useEffect(() => {
    let cancelled = false;
    void refreshWorkout().then(([resolved, completed]) => {
      if (cancelled) return;
      setWorkout(resolved);
      setWorkoutCompleted(completed);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshWorkout, todayKey, version]);

  const dateKey = formatDateKey(selectedDate);
  const workoutMissed =
    !!workout &&
    !workoutCompleted &&
    isDeadlinePassed(WORKOUT_DEADLINE, dateKey);

  return (
    <Card
      id="dashboard-workout"
      className={sectionCompletedCardClass(workoutCompleted && !!workout)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {workoutTitle(selectedDate, platform)}
          {workoutCompleted && workout && <SectionCompletedBadge />}
          <MissedButton
            count={workoutMissed ? 1 : 0}
            title={coachLabels.missedWorkout}
            hint={coachLabels.workoutMissedHint}
            items={
              workout && workoutMissed
                ? [
                    {
                      id: "workout",
                      label: workout.dayTitle,
                      detail: `${workout.planTitle} · was due by ${WORKOUT_DEADLINE}`,
                    },
                  ]
                : []
            }
          />
        </CardTitle>
        {workoutCompleted && workout ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
            aria-label={platform.aria.completed}
          >
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <StartTodaysWorkoutButton date={selectedDate} disabled={!workout} />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {workout ? (
          <div>
            <p
              className={cn(
                "font-semibold",
                workoutCompleted && "text-green-400"
              )}
            >
              {workout.dayTitle}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {workout.planTitle}
              {workout.exercises.length > 0 &&
                ` · ${platform.common.exercises(workout.exercises.length)}`}
              {workoutCompleted
                ? ` ${platform.workout.completedSuffix}`
                : ` ${platform.workout.completeBy(WORKOUT_DEADLINE)}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {workout.exercises.slice(0, 3).map((ex) => (
                <Badge key={ex.id} variant="secondary">
                  {ex.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {coachLabels.noWorkoutToday}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
