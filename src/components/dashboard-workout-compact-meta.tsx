"use client";

import { Clock, Layers } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboard } from "@/components/dashboard-ui";
import {
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { cn } from "@/lib/utils";

export function DashboardWorkoutCompactStats({
  exercises,
  className,
}: {
  exercises: { sets: number }[];
  className?: string;
}) {
  const platform = usePlatformCopy();
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const durationSeconds = estimateWorkoutDurationSeconds(
    exercises.map((exercise) => ({ target_sets: exercise.sets }))
  );
  const durationLabel = formatWorkoutDurationShort(durationSeconds);

  return (
    <div className={cn(dashboard.tile, "flex flex-col gap-2 p-2.5", className)}>
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
        <p className="min-w-0 text-sm leading-tight">
          <span className="font-black tabular-nums">{durationLabel}</span>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            {platform.workout.estimatedTimeCompact}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
        <p className="min-w-0 text-sm leading-tight">
          <span className="font-black tabular-nums">{totalSets}</span>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            {platform.workout.totalSetsCompact}
          </span>
        </p>
      </div>
    </div>
  );
}
