"use client";

import { Check, Dumbbell, Flame, PersonStanding, Zap } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboardInteractive } from "@/components/dashboard-card-nav-link";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import { isExtraWorkoutKind } from "@/lib/hiit";
import {
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { cn } from "@/lib/utils";

function SessionKindIcon({
  planKind,
  className,
}: {
  planKind: TodaysWorkoutInfo["planKind"];
  className?: string;
}) {
  if (planKind === "warmup") {
    return <Flame className={cn("text-orange-400", className)} aria-hidden />;
  }
  if (planKind === "stretch") {
    return (
      <PersonStanding className={cn("text-teal-400", className)} aria-hidden />
    );
  }
  if (planKind === "hiit") {
    return <Zap className={cn("text-fuchsia-400", className)} aria-hidden />;
  }
  return <Dumbbell className={cn("text-primary", className)} aria-hidden />;
}

function kindLabel(
  planKind: TodaysWorkoutInfo["planKind"],
  platform: ReturnType<typeof usePlatformCopy>
) {
  if (planKind === "warmup") return platform.workout.sessionTypeWarmup;
  if (planKind === "stretch") return platform.workout.sessionTypeStretch;
  if (planKind === "hiit") return "HIIT";
  return platform.workout.sessionTypeMain;
}

function kindTone(planKind: TodaysWorkoutInfo["planKind"]) {
  if (planKind === "warmup") return "border-orange-500/25 bg-orange-500/5";
  if (planKind === "stretch") return "border-teal-500/25 bg-teal-500/5";
  if (planKind === "hiit") return "border-fuchsia-500/25 bg-fuchsia-500/5";
  return "border-border/60 bg-background/50";
}

function metaLine(
  workout: TodaysWorkoutInfo,
  platform: ReturnType<typeof usePlatformCopy>
) {
  const count = workout.exercises.length;
  const countLabel = count > 0 ? platform.common.exercises(count) : null;
  const kind = kindLabel(workout.planKind, platform);

  // Interval sessions store work seconds in reps like "30s".
  if (isExtraWorkoutKind(workout.planKind) || workout.planKind === "hiit") {
    const totalWork = workout.exercises.reduce((sum, ex) => {
      const match = /^(\d+)\s*s$/i.exec(ex.reps.trim());
      return sum + (match ? Number(match[1]) * Math.max(1, ex.sets) : 0);
    }, 0);
    if (totalWork > 0) {
      return [kind, countLabel, formatWorkoutDurationShort(totalWork)]
        .filter(Boolean)
        .join(" · ");
    }
  }

  if (count > 0) {
    const duration = formatWorkoutDurationShort(
      estimateWorkoutDurationSeconds(
        workout.exercises.map((ex) => ({ target_sets: ex.sets }))
      )
    );
    return [kind, countLabel, duration].filter(Boolean).join(" · ");
  }

  return kind;
}

/** Single-line session row for the home workout card (warm-up / main / stretch). */
export function DashboardWorkoutMiniRow({
  workout,
  done,
  isDayLoaded,
  selectedDate,
  readOnly = false,
}: {
  workout: TodaysWorkoutInfo;
  done: boolean;
  isDayLoaded: boolean;
  selectedDate: Date;
  readOnly?: boolean;
}) {
  const platform = usePlatformCopy();

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
        kindTone(workout.planKind)
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60",
          done && "opacity-60"
        )}
      >
        <SessionKindIcon planKind={workout.planKind} className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold leading-tight",
            done && "text-muted-foreground line-through"
          )}
        >
          {workout.dayTitle || workout.planTitle}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {metaLine(workout, platform)}
        </p>
      </div>

      <div className={cn("shrink-0", dashboardInteractive)}>
        {done ? (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
            aria-label={platform.aria.completed}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
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
