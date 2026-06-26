"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play } from "lucide-react";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { startTodaysWorkoutAndRedirect } from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartTodaysWorkoutButton({
  date,
  disabled,
}: {
  date: Date;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
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
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <StartWorkoutLoadingShell isLoading={isStarting}>
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
      </StartWorkoutLoadingShell>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
