"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { startPlanWorkout } from "@/lib/actions/workout-sessions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartWorkoutDayButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await startPlanWorkout(planId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        router.refresh();
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <StartWorkoutLoadingShell isLoading={isPending} ring={false}>
        <Button
          size="sm"
          disabled={isPending}
          onClick={handleStart}
          aria-busy={isPending}
          className="min-w-[5.75rem] justify-center"
        >
          <Play className={cn("mr-1 h-3 w-3", isPending && "opacity-50")} />
          {isPending ? "Opening…" : "Start"}
        </Button>
      </StartWorkoutLoadingShell>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
