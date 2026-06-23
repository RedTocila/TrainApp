"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Dumbbell } from "lucide-react";
import { useSelectedDate } from "@/components/date-provider";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  getInProgressSession,
  resolveWorkoutForDate,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function WorkoutTabBanner({
  clientId,
  initialWorkout,
  initialInProgressSessionId,
}: {
  clientId: string;
  initialWorkout: TodaysWorkoutInfo | null;
  initialInProgressSessionId: string | null;
}) {
  const { selectedDate } = useSelectedDate();
  const [workout, setWorkout] = useState(initialWorkout);
  const [inProgressSessionId, setInProgressSessionId] = useState(
    initialInProgressSessionId
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const [resolved, inProgress] = await Promise.all([
        resolveWorkoutForDate(clientId, dateKey),
        getInProgressSession(),
      ]);
      setWorkout(resolved);
      setInProgressSessionId(inProgress?.id ?? null);
    });
  }, [selectedDate, clientId]);

  if (inProgressSessionId) {
    return (
      <Card id="dashboard-workout" className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Workout in progress</p>
              <p className="text-sm text-muted-foreground">
                Pick up where you left off
              </p>
            </div>
          </div>
          <Link href={`/dashboard/workout/session/${inProgressSessionId}`}>
            <Button size="sm">Continue</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!workout) return null;

  return (
    <Card id="dashboard-workout">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Scheduled workout
          </p>
          <p className="font-semibold">{workout.dayTitle}</p>
          <p className="text-sm text-muted-foreground">{workout.planTitle}</p>
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
        <StartTodaysWorkoutButton date={selectedDate} />
      </CardContent>
    </Card>
  );
}
