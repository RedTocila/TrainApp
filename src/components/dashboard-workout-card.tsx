"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday, isTomorrow } from "date-fns";
import { Check, Dumbbell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { isWorkoutCompletedFromPatches } from "@/lib/dashboard-enrichment-utils";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
import {
  resolveWorkoutForDate,
  isWorkoutCompletedOnDate,
  getCompletedWorkoutResultsForDate,
  type TodaysWorkoutInfo,
  type CompletedWorkoutResults,
} from "@/lib/actions/workout-sessions";
import { WorkoutResultsDropdown } from "@/components/workout-results-dropdown";
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
  const { version, patches } = useDashboardSync();
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(
    initialWorkoutCompleted
  );
  const [workoutResults, setWorkoutResults] =
    useState<CompletedWorkoutResults | null>(null);

  // Sync SSR props only when the server revalidates.
  useEffect(() => {
    setWorkout(initialWorkout);
    setWorkoutCompleted(initialWorkoutCompleted);
  }, [initialWorkout, initialWorkoutCompleted]);

  const refreshWorkout = useCallback(async () => {
    const dateKey = formatDateKey(selectedDate);
    const [resolved, completed] = await Promise.all([
      resolveWorkoutForDate(clientId, dateKey),
      isWorkoutCompletedOnDate(clientId, dateKey),
    ]);
    setWorkout(resolved);
    setWorkoutCompleted(completed);
    if (completed) {
      const results = await getCompletedWorkoutResultsForDate(clientId, dateKey);
      setWorkoutResults(results);
    } else {
      setWorkoutResults(null);
    }
  }, [clientId, selectedDate]);

  const isReady = useDashboardDateFetch(formatDateKey(selectedDate), refreshWorkout, [
    clientId,
    version,
    todayKey,
  ]);

  const dateKey = formatDateKey(selectedDate);
  const workoutForDay = isReady ? workout : null;
  const patchedComplete = isWorkoutCompletedFromPatches(patches, dateKey);
  const workoutCompletedForDay =
    isReady && (workoutCompleted || patchedComplete);
  useEffect(() => {
    if (!workoutCompletedForDay || workoutResults) return;
    void getCompletedWorkoutResultsForDate(clientId, dateKey).then((results) => {
      if (results) setWorkoutResults(results);
    });
  }, [workoutCompletedForDay, workoutResults, clientId, dateKey]);

  const workoutMissed =
    !!workoutForDay &&
    !workoutCompletedForDay &&
    isDeadlinePassed(WORKOUT_DEADLINE, dateKey);

  return (
    <Card
      id="dashboard-workout"
      className={sectionCompletedCardClass(workoutCompletedForDay && !!workoutForDay)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {workoutTitle(selectedDate, platform)}
          {workoutCompletedForDay && workoutForDay && <SectionCompletedBadge />}
          <MissedButton
            count={workoutForDay && !workoutCompletedForDay && workoutMissed ? 1 : 0}
            title={coachLabels.missedWorkout}
            hint={coachLabels.workoutMissedHint}
            items={
              workoutForDay && workoutMissed
                ? [
                    {
                      id: "workout",
                      label: workoutForDay.dayTitle,
                      detail: `${workoutForDay.planTitle} · was due by ${WORKOUT_DEADLINE}`,
                    },
                  ]
                : []
            }
          />
        </CardTitle>
        {workoutCompletedForDay && workoutForDay ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
            aria-label={platform.aria.completed}
          >
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <StartTodaysWorkoutButton
            date={selectedDate}
            disabled={!workoutForDay || !isReady}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isReady && workoutForDay ? (
          <div>
            <p
              className={cn(
                "font-semibold",
                workoutCompletedForDay && "text-green-400"
              )}
            >
              {workoutForDay.dayTitle}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {workoutForDay.planTitle}
              {workoutForDay.exercises.length > 0 &&
                ` · ${platform.common.exercises(workoutForDay.exercises.length)}`}
              {workoutCompletedForDay
                ? ` ${platform.workout.completedSuffix}`
                : ` ${platform.workout.completeBy(WORKOUT_DEADLINE)}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {workoutForDay.exercises.slice(0, 3).map((ex) => (
                <Badge key={ex.id} variant="secondary">
                  {ex.name}
                </Badge>
              ))}
            </div>
            {workoutCompletedForDay && workoutResults ? (
              <div className="mt-4">
                <WorkoutResultsDropdown results={workoutResults} />
              </div>
            ) : null}
          </div>
        ) : isReady ? (
          <p className="text-sm text-muted-foreground">
            {coachLabels.noWorkoutToday}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
