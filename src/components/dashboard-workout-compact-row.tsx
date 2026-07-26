"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import { dashboardInteractive } from "@/components/dashboard-card-nav-link";
import { DashboardWorkoutCompactStats } from "@/components/dashboard-workout-compact-meta";
import { DashboardStatusCheck } from "@/components/section-completed-badge";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function planKindBadge(
  planKind: TodaysWorkoutInfo["planKind"],
  platform: ReturnType<typeof usePlatformCopy>
) {
  if (planKind === "warmup") {
    return (
      <Badge className="bg-orange-500/15 text-[10px] text-orange-400">
        {platform.workout.sessionTypeWarmup}
      </Badge>
    );
  }
  if (planKind === "stretch") {
    return (
      <Badge className="bg-teal-500/15 text-[10px] text-teal-400">
        {platform.workout.sessionTypeStretch}
      </Badge>
    );
  }
  return null;
}

export function DashboardWorkoutCompactRow({
  workout,
  workoutKey,
  selected,
  done,
  isDayLoaded,
  selectedDate,
  onSelect,
  readOnly = false,
}: {
  workout: TodaysWorkoutInfo;
  workoutKey: string;
  selected: boolean;
  done: boolean;
  isDayLoaded: boolean;
  selectedDate: Date;
  onSelect: (workoutKey: string) => void;
  readOnly?: boolean;
}) {
  const platform = usePlatformCopy();
  const kindBadge = planKindBadge(workout.planKind, platform);

  return (
    <li
      className={cn(
        "flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-background/50 p-2.5",
        selected && "border-primary/40 ring-1 ring-primary/25"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(workoutKey)}
        className="flex min-w-0 flex-1 touch-manipulation select-none items-start text-left"
        aria-pressed={selected}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={cn(
                "text-sm font-bold leading-snug",
                done && "text-muted-foreground line-through"
              )}
            >
              {workout.dayTitle}
            </p>
            {kindBadge}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {workout.planTitle}
            {workout.exercises.length > 0
              ? ` · ${platform.common.exercises(workout.exercises.length)}`
              : null}
          </p>
          {workout.exercises.length > 0 ? (
            <DashboardWorkoutCompactStats
              exercises={workout.exercises}
              size="sm"
              className="mt-1.5"
            />
          ) : null}
        </div>
      </button>
      <div className={cn("shrink-0", dashboardInteractive)}>
        {done ? (
          <DashboardStatusCheck aria-label={platform.aria.completed} />
        ) : readOnly ? null : (
          <StartTodaysWorkoutButton
            date={selectedDate}
            workout={workout}
            disabled={!isDayLoaded}
          />
        )}
      </div>
    </li>
  );
}
