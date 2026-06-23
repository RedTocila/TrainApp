"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { startPlanWorkout } from "@/lib/actions/workout-sessions";
import { Button } from "@/components/ui/button";

export function StartWorkoutDayButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
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
      <Button size="sm" disabled={isPending} onClick={handleStart}>
        <Play className="mr-1 h-3 w-3" />
        {isPending ? "Starting…" : "Start"}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
