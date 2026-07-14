"use client";

import { Dumbbell, Zap } from "lucide-react";
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
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <button
        type="button"
        onClick={() => onChange("strength")}
        className={cn(
          "rounded-2xl border p-5 text-left transition-colors",
          value === "strength"
            ? "border-primary bg-primary/10"
            : "border-border/60 bg-card/80 hover:border-border hover:bg-secondary/40"
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          <Dumbbell className="h-5 w-5 text-primary" />
        </div>
        <p className="mt-4 text-lg font-black tracking-tight">Fitness workout</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Classic training with sets, reps, and rest between sets.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange("hiit")}
        className={cn(
          "rounded-2xl border p-5 text-left transition-colors",
          value === "hiit"
            ? "border-fuchsia-500/70 bg-fuchsia-500/10"
            : "border-border/60 bg-card/80 hover:border-border hover:bg-secondary/40"
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/15">
          <Zap className="h-5 w-5 text-fuchsia-400" />
        </div>
        <p className="mt-4 text-lg font-black tracking-tight">HIIT workout</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Timed intervals — work, rest, rounds, and cycles with a live timer.
        </p>
      </button>
    </div>
  );
}
