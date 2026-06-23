"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { Dumbbell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  resolveWorkoutForDate,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function workoutTitle(date: Date) {
  if (isToday(date)) return "Today's Workout";
  if (isTomorrow(date)) return "Tomorrow's Workout";
  return `${format(date, "EEEE")}'s Workout`;
}

export function DashboardWorkoutCard({
  clientId,
  initialWorkout,
}: {
  clientId: string;
  initialWorkout: TodaysWorkoutInfo | null;
}) {
  const { selectedDate } = useSelectedDate();
  const [workout, setWorkout] = useState(initialWorkout);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const resolved = await resolveWorkoutForDate(clientId, dateKey);
      setWorkout(resolved);
    });
  }, [selectedDate, clientId]);

  return (
    <Card id="dashboard-workout">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {workoutTitle(selectedDate)}
        </CardTitle>
        <StartTodaysWorkoutButton date={selectedDate} disabled={!workout} />
      </CardHeader>
      <CardContent>
        {workout ? (
          <div>
            <p className="font-semibold">{workout.dayTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {workout.planTitle}
              {workout.exercises.length > 0 &&
                ` · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`}
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
            No workout scheduled for this day
          </p>
        )}
      </CardContent>
    </Card>
  );
}
