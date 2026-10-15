"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { ArrowUpRight, CalendarDays, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  startTodaysWorkoutAndRedirect,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { DASHBOARD_DAY_WORKOUT_PATH } from "@/lib/dashboard-day-routes";
import { formatDateKey } from "@/lib/utils";
import {
  stageWorkoutOpen,
  WORKOUT_SESSION_OPEN_PATH,
} from "@/lib/staged-workout-open";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardInteractive } from "@/components/dashboard-card-nav-link";

export function useStartWorkout(
  date: Date,
  workout?: TodaysWorkoutInfo | null,
  disabled?: boolean,
  options?: {
    dayFlow?: boolean;
    gender?: string | null;
    continuesToMain?: boolean;
    resumeSessionId?: string | null;
  }
) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayFlow = options?.dayFlow ?? !workout;
  const gender = options?.gender;
  const continuesToMain = options?.continuesToMain;
  const resumeSessionId = options?.resumeSessionId;

  useEffect(() => {
    try {
      router.prefetch(
        resumeSessionId
          ? `/dashboard/workout/session/${resumeSessionId}`
          : WORKOUT_SESSION_OPEN_PATH
      );
    } catch {
      // Prefetch is best-effort.
    }
  }, [resumeSessionId, router]);

  const start = useCallback(() => {
    if (disabled || isStarting) return;
    setError(null);
    if (resumeSessionId) {
      setIsStarting(true);
      router.push(`/dashboard/workout/session/${resumeSessionId}`);
      return;
    }
    if (workout?.planId && workout.dayId) {
      const opened = stageWorkoutOpen(workout, { gender, continuesToMain });
      if (!opened) return;
      setIsStarting(true);
      router.push(WORKOUT_SESSION_OPEN_PATH);
      return;
    }
    setIsStarting(true);
    const dateKey = formatDateKey(date);
    void startTodaysWorkoutAndRedirect(dateKey, {
      scheduledWorkoutId: workout?.scheduledWorkoutId,
      planId: workout?.planId,
      dayId: workout?.dayId,
      scheduledDate: workout?.scheduledDate ?? dateKey,
      dayFlow,
    })
      .then((result) => {
        if (result && "sessionId" in result && result.sessionId) {
          router.push(`/dashboard/workout/session/${result.sessionId}`);
          return;
        }
        if (result && "error" in result && result.error) {
          setError(result.error);
          setIsStarting(false);
          if ("sessionId" in result && result.sessionId) {
            router.push(`/dashboard/workout/session/${result.sessionId}`);
          } else {
            router.refresh();
          }
          return;
        }
        setIsStarting(false);
        setError("Could not start workout");
      })
      .catch(() => {
        setIsStarting(false);
        setError("Could not start workout");
      });
  }, [
    continuesToMain,
    date,
    dayFlow,
    disabled,
    gender,
    isStarting,
    resumeSessionId,
    router,
    workout,
  ]);

  return { start, isStarting, error };
}

export function useStartTodaysWorkout(date: Date, disabled?: boolean) {
  return useStartWorkout(date, null, disabled, { dayFlow: true });
}

export function StartWorkoutButton({
  date,
  workout,
  disabled,
  display = "icon",
  className,
  dayFlow,
  gender,
  continuesToMain,
  resumeSessionId,
}: {
  date: Date;
  workout?: TodaysWorkoutInfo | null;
  disabled?: boolean;
  display?: "icon" | "text" | "hero" | "label" | "nav";
  className?: string;
  dayFlow?: boolean;
  gender?: string | null;
  continuesToMain?: boolean;
  resumeSessionId?: string | null;
}) {
  const platform = usePlatformCopy();
  const { start, isStarting, error } = useStartWorkout(date, workout, disabled, {
    dayFlow,
    gender,
    continuesToMain,
    resumeSessionId,
  });
  const actionLabel = resumeSessionId
    ? platform.common.inProgress
    : platform.workout.startWorkout;
  const shortLabel = resumeSessionId
    ? platform.common.inProgress
    : platform.workout.start;

  const handleStart = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    start();
  };

  if (display === "hero") {
    return (
      <div className={cn("flex w-full flex-col gap-1", className)}>
        <div className={cn("flex items-center gap-2", dashboardInteractive)}>
          <StartWorkoutLoadingShell isLoading={isStarting} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={disabled || isStarting}
              onClick={handleStart}
              aria-busy={isStarting}
              className={cn(
                "relative flex h-12 w-full items-center justify-center rounded-2xl px-4",
                "bg-gradient-to-r from-primary to-primary/80 text-sm font-black text-primary-foreground",
                "shadow-md shadow-primary/25 transition hover:brightness-110",
                "disabled:opacity-60"
              )}
            >
              <span className="truncate">
                {isStarting ? platform.workout.starting : actionLabel}
              </span>
              <span className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-primary shadow-sm">
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : resumeSessionId ? (
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </span>
            </button>
          </StartWorkoutLoadingShell>
          <Link
            href={DASHBOARD_DAY_WORKOUT_PATH}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              "border border-border/60 bg-background/50 text-foreground backdrop-blur-sm",
              "transition hover:bg-background/80"
            )}
            aria-label={platform.workout.openDayCalendar}
          >
            <CalendarDays className="h-5 w-5" />
          </Link>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <StartWorkoutLoadingShell
        isLoading={isStarting}
        ring={display === "icon"}
        className={className?.includes("w-full") ? "w-full" : undefined}
      >
        {display === "text" ? (
          <Button
            size="sm"
            className="w-full shrink-0 rounded-full px-3 font-semibold shadow-sm"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : resumeSessionId ? (
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isStarting ? platform.workout.starting : actionLabel}
          </Button>
        ) : display === "label" || display === "nav" ? (
          <Button
            size="sm"
            className={cn(
              "shrink-0 rounded-full font-bold shadow-sm",
              display === "nav" ? "px-4 text-sm" : "px-3 text-sm"
            )}
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : resumeSessionId ? (
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {isStarting ? platform.workout.starting : shortLabel}
          </Button>
        ) : (
          <Button
            size="icon"
            className="rounded-full"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
            aria-label={isStarting ? platform.workout.starting : shortLabel}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : resumeSessionId ? (
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        )}
      </StartWorkoutLoadingShell>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function StartTodaysWorkoutButton({
  date,
  workout,
  disabled,
  display = "icon",
  className,
  dayFlow,
  gender,
  continuesToMain,
  resumeSessionId,
}: {
  date: Date;
  workout?: TodaysWorkoutInfo | null;
  disabled?: boolean;
  display?: "icon" | "text" | "hero" | "label" | "nav";
  className?: string;
  dayFlow?: boolean;
  gender?: string | null;
  continuesToMain?: boolean;
  resumeSessionId?: string | null;
}) {
  return (
    <StartWorkoutButton
      date={date}
      workout={workout}
      disabled={disabled}
      display={display}
      className={className}
      dayFlow={dayFlow}
      gender={gender}
      continuesToMain={continuesToMain}
      resumeSessionId={resumeSessionId}
    />
  );
}
