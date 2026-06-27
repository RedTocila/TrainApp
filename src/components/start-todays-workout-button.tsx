"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type MouseEvent } from "react";
import { Play } from "lucide-react";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { usePlatformCopy } from "@/components/locale-provider";
import { startTodaysWorkoutAndRedirect } from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function useStartTodaysWorkout(date: Date, disabled?: boolean) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    if (disabled || isStarting) return;
    setError(null);
    setIsStarting(true);
    void startTodaysWorkoutAndRedirect(formatDateKey(date)).then((result) => {
      if (result && "error" in result && result.error) {
        setError(result.error);
        setIsStarting(false);
        router.refresh();
      }
    });
  }, [date, disabled, isStarting, router]);

  return { start, isStarting, error };
}

export function StartTodaysWorkoutButton({
  date,
  disabled,
  display = "icon",
  className,
}: {
  date: Date;
  disabled?: boolean;
  display?: "icon" | "text";
  className?: string;
}) {
  const platform = usePlatformCopy();
  const { start, isStarting, error } = useStartTodaysWorkout(date, disabled);

  const handleStart = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    start();
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <StartWorkoutLoadingShell isLoading={isStarting}>
        {display === "text" ? (
          <Button
            size="sm"
            className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
          >
            <Play className="h-3.5 w-3.5" />
            {platform.workout.startWorkout}
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={disabled || isStarting}
            onClick={handleStart}
            aria-busy={isStarting}
            aria-label={isStarting ? "Opening workout" : "Open workout"}
          >
            <Play className={cn("h-4 w-4", isStarting && "opacity-50")} />
          </Button>
        )}
      </StartWorkoutLoadingShell>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
