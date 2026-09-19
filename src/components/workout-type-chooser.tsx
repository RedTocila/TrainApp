"use client";

import { Dumbbell, Zap } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export type CreateWorkoutType = "strength" | "hiit";

/** Icon + label tiles for fitness vs HIIT (no cards — overlay picker style). */
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

  const options = [
    {
      id: "strength" as const,
      label: platform.workout.fitnessWorkout,
      icon: Dumbbell,
      accent: "text-primary",
    },
    {
      id: "hiit" as const,
      label: platform.workout.hiitWorkout,
      icon: Zap,
      accent: "text-fuchsia-400",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-8", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value == null ? undefined : selected}
            className="flex flex-col items-center gap-3 transition-transform duration-200 active:scale-95"
          >
            <Icon
              className={cn("h-12 w-12", option.accent)}
              strokeWidth={1.75}
            />
            <span className="text-center text-sm font-bold leading-tight text-foreground">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
