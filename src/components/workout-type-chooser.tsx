"use client";

import { Dumbbell, Zap } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export type CreateWorkoutType = "strength" | "hiit";

export function WorkoutTypeChooser({
  value,
  onChange,
  className,
}: {
  value: CreateWorkoutType | null;
  onChange: (type: CreateWorkoutType) => void;
  className?: string;
}) {
  const platform = usePlatformCopy();

  return (
    <div className={cn("grid grid-cols-2 gap-2.5", className)}>
      <button
        type="button"
        onClick={() => onChange("strength")}
        className={cn(
          "group relative flex aspect-square flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm",
          "transition-[transform,border-color] duration-200 active:scale-[0.98]",
          value === "strength"
            ? "border-primary/55"
            : "border-primary/30 hover:border-primary/55"
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/18 via-card to-card"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full bg-primary/25 blur-2xl"
        />
        <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Dumbbell className="h-5 w-5" />
        </span>
        <span className="relative z-10 text-center text-[12px] font-bold leading-tight">
          {platform.workout.fitnessWorkout}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange("hiit")}
        className={cn(
          "group relative flex aspect-square flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm",
          "transition-[transform,border-color] duration-200 active:scale-[0.98]",
          value === "hiit"
            ? "border-fuchsia-500/70"
            : "border-fuchsia-500/30 hover:border-fuchsia-400/55"
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/18 via-card to-card"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full bg-fuchsia-400/25 blur-2xl"
        />
        <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-400">
          <Zap className="h-5 w-5" />
        </span>
        <span className="relative z-10 text-center text-[12px] font-bold leading-tight">
          {platform.workout.hiitWorkout}
        </span>
      </button>
    </div>
  );
}
