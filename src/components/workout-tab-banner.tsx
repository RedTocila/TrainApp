"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Dumbbell } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
  const { selectedDate } = useSelectedDate();
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
  }, [selectedDate, clientId, version]);

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

  return (
    <Card
      id="dashboard-workout"
      className={sectionCompletedCardClass(workoutCompleted)}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {platform.workout.scheduledWorkout}
            </p>
            {workoutCompleted && <SectionCompletedBadge />}
          </div>
          <p className={cn("font-semibold", workoutCompleted && "text-green-400")}>
            {workout.dayTitle}
          </p>
          <p className="text-sm text-muted-foreground">
            {workout.planTitle}
            {workoutCompleted ? ` ${platform.workout.completedSuffix}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {workout.exercises.slice(0, 4).map((ex) => (
              <Badge key={ex.id} variant="secondary">
                {ex.name}
              </Badge>
            ))}
            {workout.exercises.length > 4 && (
              <Badge variant="outline">+{workout.exercises.length - 4}</Badge>
            )}
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
