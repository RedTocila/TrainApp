"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { startTodaysWorkoutAndRedirect } from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function StartTodaysWorkoutButton({
  date,
  disabled,
}: {
  date: Date;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await startTodaysWorkoutAndRedirect(formatDateKey(date));
      if (result && "error" in result && result.error) {
        setError(result.error);
        router.refresh();
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={disabled || isPending}
        onClick={handleStart}
      >
        <Play className="mr-1 h-3.5 w-3.5" />
        {isPending ? "Starting…" : "Start"}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
