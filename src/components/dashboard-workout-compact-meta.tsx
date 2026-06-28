"use client";

import { Clock, Layers } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { cn } from "@/lib/utils";

export function DashboardWorkoutCompactStats({
  exercises,
  className,
  size = "default",
}: {
  exercises: { sets: number }[];
  className?: string;
  size?: "default" | "sm";
}) {
  const platform = usePlatformCopy();
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const durationSeconds = estimateWorkoutDurationSeconds(
    exercises.map((exercise) => ({ target_sets: exercise.sets }))
  );
  const durationLabel = formatWorkoutDurationShort(durationSeconds);
  const compact = size === "sm";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1",
        compact && "gap-x-3",
        className
      )}
    >
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
        <Clock
          className={cn(
            "shrink-0 text-cyan-400",
            compact ? "h-3 w-3" : "h-3.5 w-3.5"
          )}
          aria-hidden
        />
        <p className={cn("min-w-0 leading-tight", compact ? "text-xs" : "text-sm")}>
          <span className="font-black tabular-nums">{durationLabel}</span>
          <span
            className={cn(
              "ml-1.5 text-muted-foreground",
              compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            {platform.workout.estimatedTimeCompact}
          </span>
        </p>
      </div>
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
        <Layers
          className={cn(
            "shrink-0 text-violet-400",
            compact ? "h-3 w-3" : "h-3.5 w-3.5"
          )}
          aria-hidden
        />
        <p className={cn("min-w-0 leading-tight", compact ? "text-xs" : "text-sm")}>
          <span className="font-black tabular-nums">{totalSets}</span>
          <span
            className={cn(
              "ml-1.5 text-muted-foreground",
              compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            {platform.workout.totalSetsCompact}
          </span>
        </p>
      </div>
    </div>
  );
}
