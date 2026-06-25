"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday, isTomorrow } from "date-fns";
import { Check, Dumbbell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
}: {
  clientId: string;
  initialWorkout: TodaysWorkoutInfo | null;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate } = useSelectedDate();
  const { version } = useDashboardSync();
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const [resolved, completed] = await Promise.all([
        resolveWorkoutForDate(clientId, dateKey),
        isWorkoutCompletedOnDate(clientId, dateKey),
      ]);
      setWorkout(resolved);
      setWorkoutCompleted(completed);
    });
  }, [selectedDate, clientId, version]);

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
            hint="Tomorrow: train before excuses wake up."
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
            aria-label="Completed"
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
                ` · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`}
              {workoutCompleted
                ? " · completed"
                : ` · complete by ${WORKOUT_DEADLINE}`}
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
