"use client";

import { Dumbbell } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboard, DashboardSectionHeading } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function WorkoutExerciseList({
  exercises,
  className,
  variant = "default",
}: {
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    notes: string | null;
  }[];
  className?: string;
  variant?: "default" | "dropdown";
}) {
  const platform = usePlatformCopy();

  if (exercises.length === 0) {
    return null;
  }

  if (variant === "dropdown") {
    return (
      <ul className={cn("divide-y divide-border/60", className)}>
        {exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="flex items-start justify-between gap-2 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{exercise.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {platform.workout.setsTarget(exercise.sets)} ·{" "}
                {platform.workout.repsTarget(exercise.reps)}
              </p>
              {exercise.notes ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {exercise.notes}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <DashboardSectionHeading className="mb-0">
          {platform.workout.exercisesTile}
        </DashboardSectionHeading>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
          {exercises.length}
        </Badge>
      </div>
      <ul className="space-y-2">
        {exercises.map((exercise, index) => (
          <li key={exercise.id} className={cn(dashboard.listRow, "items-start py-3")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug">{exercise.name}</p>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {index + 1}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-secondary/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                  {platform.workout.setsTarget(exercise.sets)}
                </span>
                <span className="rounded-lg bg-secondary/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                  {platform.workout.repsTarget(exercise.reps)}
                </span>
              </div>
              {exercise.notes ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {exercise.notes}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
