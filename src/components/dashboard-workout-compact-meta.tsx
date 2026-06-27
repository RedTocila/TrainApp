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
    <div className={cn(dashboard.tile, "flex items-center gap-2.5 p-2.5", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
        <Clock className="h-4 w-4 text-cyan-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-black tabular-nums leading-none">{durationLabel}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {platform.workout.estimatedTime}
        </p>
      </div>
      <div className="flex items-center gap-2 border-l border-border/60 pl-2.5">
        <Layers className="h-4 w-4 shrink-0 text-violet-400" />
        <div>
          <p className="text-sm font-black tabular-nums leading-none">{totalSets}</p>
          <p className="text-[10px] text-muted-foreground">{platform.workout.totalSetsLabel}</p>
        </div>
      </div>
    </div>
  );
}
