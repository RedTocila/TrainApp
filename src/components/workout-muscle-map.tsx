"use client";

import Body from "@mjcdev/react-body-highlighter";
import { useMemo } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  resolveBodyMapGender,
  resolveWorkoutMuscleSlugs,
  toBodyHighlighterData,
} from "@/lib/muscle-map-utils";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLORS = ["#fca5a5", "#ef4444"] as const;

export function WorkoutMuscleMap({
  exercises,
  dayTitle,
  gender,
  className,
  variant = "full",
}: {
  exercises: { name: string }[];
  dayTitle?: string;
  gender?: string | null;
  className?: string;
  variant?: "full" | "compact";
}) {
  const platform = usePlatformCopy();
  const bodyGender = resolveBodyMapGender(gender);

  const highlightData = useMemo(() => {
    const slugs = resolveWorkoutMuscleSlugs(exercises, dayTitle);
    return toBodyHighlighterData(slugs);
  }, [exercises, dayTitle]);

  if (exercises.length === 0 || highlightData.length === 0) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div
        className={cn("relative h-full w-full", className)}
        aria-hidden
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Body
            data={highlightData}
            gender={bodyGender}
            side="front"
            scale={0.64}
            colors={HIGHLIGHT_COLORS}
            border="none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <div className="flex items-start justify-center gap-2 sm:gap-4">
        <div className="flex flex-1 flex-col items-center">
          <Body
            data={highlightData}
            gender={bodyGender}
            side="front"
            scale={0.85}
            colors={HIGHLIGHT_COLORS}
            border="none"
          />
          <span className="mt-1 text-[10px] text-muted-foreground">
            {platform.workout.muscleMapFront}
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <Body
            data={highlightData}
            gender={bodyGender}
            side="back"
            scale={0.85}
            colors={HIGHLIGHT_COLORS}
            border="none"
          />
          <span className="mt-1 text-[10px] text-muted-foreground">
            {platform.workout.muscleMapBack}
          </span>
        </div>
      </div>
    </div>
  );
}
