"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Dumbbell } from "lucide-react";
import {
  getWorkoutCategoryStyle,
  inferWorkoutCategoryFromText,
} from "@/lib/workout-visual-categories";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
import {
  getInProgressSession,
  isWorkoutCompletedOnDate,
  resolveWorkoutForDate,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkoutTabBanner({
  clientId,
  initialWorkout,
  initialInProgressSessionId,
  initialWorkoutCompleted = false,
}: {
  clientId: string;
  initialWorkout: TodaysWorkoutInfo | null;
  initialInProgressSessionId: string | null;
  initialWorkoutCompleted?: boolean;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version } = useDashboardSync();
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(initialWorkoutCompleted);
  const [inProgressSessionId, setInProgressSessionId] = useState(
    initialInProgressSessionId
  );
  const [inProgressStarted, setInProgressStarted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const [resolved, inProgress, completed] = await Promise.all([
        resolveWorkoutForDate(clientId, dateKey),
        getInProgressSession(),
        isWorkoutCompletedOnDate(clientId, dateKey),
      ]);
      setWorkout(resolved);
      setInProgressSessionId(inProgress?.id ?? null);
      setInProgressStarted(inProgress?.started_at != null);
      setWorkoutCompleted(completed);
    });
  }, [selectedDate, todayKey, clientId, version]);

  if (inProgressSessionId) {
    return (
      <Card id="dashboard-workout" className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">
                {inProgressStarted
                  ? coachLabels.workoutInProgress
                  : platform.workout.readyToStart}
              </p>
              <p className="text-sm text-muted-foreground">
                {inProgressStarted
                  ? coachLabels.pickUpWorkout
                  : platform.workout.startWorkout}
              </p>
            </div>
          </div>
          <Link href={`/dashboard/workout/session/${inProgressSessionId}`}>
            <Button size="sm">
              {inProgressStarted
                ? coachLabels.getBackInThere
                : platform.workout.startWorkout}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!workout) return null;

  const category = inferWorkoutCategoryFromText(
    workout.dayTitle,
    workout.planTitle,
    ...workout.exercises.map((e) => e.name)
  );
  const style = getWorkoutCategoryStyle(category);

  return (
    <Card
      id="dashboard-workout"
      className={cn(
        "overflow-hidden border-2",
        sectionCompletedCardClass(workoutCompleted),
        !workoutCompleted && style.cardBorder,
        !workoutCompleted && style.cardBg
      )}
    >
      {!workoutCompleted && <div className={cn("h-1.5 w-full", style.stripe)} aria-hidden />}
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {!workoutCompleted && <WorkoutCategoryIcon category={category} />}
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {workoutCompleted && <SectionCompletedBadge />}
          </div>
          <p className={cn("font-bold", workoutCompleted && "text-green-400")}>
            {workout.dayTitle}
          </p>
          <p className="text-sm text-muted-foreground">
            {workout.planTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {workout.exercises.slice(0, 5).map((ex) => {
              const exStyle = getWorkoutCategoryStyle(
                inferWorkoutCategoryFromText(ex.name)
              );
              return (
                <span
                  key={ex.id}
                  className={cn(
                    "rounded-lg border px-2 py-0.5 text-[11px] font-medium",
                    exStyle.chip,
                    exStyle.chipText
                  )}
                >
                  {ex.name}
                </span>
              );
            })}
            {workout.exercises.length > 5 && (
              <span className="rounded-lg bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                +{workout.exercises.length - 5}
              </span>
            )}
          </div>
          </div>
        </div>
        {workoutCompleted ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full border border-green-500 bg-green-500 text-white sm:self-center"
            aria-label={platform.aria.completed}
          >
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <StartTodaysWorkoutButton date={selectedDate} />
        )}
      </CardContent>
    </Card>
  );
}
