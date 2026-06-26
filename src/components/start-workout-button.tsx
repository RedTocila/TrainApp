"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { startWorkoutAndRedirect } from "@/lib/actions/workout-sessions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StartWorkoutButtonProps {
  planId: string;
  dayId: string;
  scheduledDate?: string | null;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export function StartWorkoutButton({
  planId,
  dayId,
  scheduledDate,
  label = "Start",
  size = "sm",
  variant = "default",
  className,
}: StartWorkoutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await startWorkoutAndRedirect({
        planId,
        dayId,
        scheduledDate,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        router.refresh();
      }
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Button
        size={size}
        variant={variant}
        disabled={isPending}
        onClick={handleStart}
      >
        <Play className="mr-1 h-3.5 w-3.5" />
        {isPending ? "Opening…" : label}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
