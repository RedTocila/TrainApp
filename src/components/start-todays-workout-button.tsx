"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type MouseEvent } from "react";
import { CalendarDays, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  startTodaysWorkoutAndRedirect,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { DASHBOARD_DAY_WORKOUT_PATH } from "@/lib/dashboard-day-routes";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardInteractive } from "@/components/dashboard-card-nav-link";

export function useStartWorkout(
  date: Date,
  workout?: TodaysWorkoutInfo | null,
  disabled?: boolean,
  options?: { dayFlow?: boolean }
) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayFlow = options?.dayFlow ?? !workout;

  const start = useCallback(() => {
    if (disabled || isStarting) return;
    setError(null);
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
  }, [date, dayFlow, disabled, isStarting, router, workout]);

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
}: {
  date: Date;
  workout?: TodaysWorkoutInfo | null;
  disabled?: boolean;
  display?: "icon" | "text" | "hero";
  className?: string;
  dayFlow?: boolean;
}) {
  const platform = usePlatformCopy();
  const { start, isStarting, error } = useStartWorkout(date, workout, disabled, {
    dayFlow,
  });

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
                {isStarting ? platform.workout.starting : platform.workout.startWorkout}
              </span>
              <span className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-primary shadow-sm">
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
            className="h-8 w-full shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isStarting ? platform.workout.starting : platform.workout.startWorkout}
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
            aria-label={isStarting ? platform.workout.starting : "Open workout"}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4" />
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
}: {
  date: Date;
  workout?: TodaysWorkoutInfo | null;
  disabled?: boolean;
  display?: "icon" | "text" | "hero";
  className?: string;
  dayFlow?: boolean;
}) {
  return (
    <StartWorkoutButton
      date={date}
      workout={workout}
      disabled={disabled}
      display={display}
      className={className}
      dayFlow={dayFlow}
    />
  );
}
