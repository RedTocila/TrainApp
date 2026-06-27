"use client";

import Body from "@mjcdev/react-body-highlighter";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  resolveBodyMapGender,
  resolveWorkoutMuscleSlugs,
  toBodyHighlighterData,
} from "@/lib/muscle-map-utils";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLORS = ["#fca5a5", "#ef4444"] as const;
const BODY_RENDER_WIDTH = 200;
const BODY_RENDER_HEIGHT = 400;

function CompactMuscleMapBody({
  highlightData,
  bodyGender,
  className,
}: {
  highlightData: ReturnType<typeof toBodyHighlighterData>;
  bodyGender: "male" | "female";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateScale = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      const fitScale = Math.min(
        width / BODY_RENDER_WIDTH,
        height / BODY_RENDER_HEIGHT
      );
      setScale(Math.max(0.25, fitScale * 0.98));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full min-h-[10rem] items-center justify-center",
        className
      )}
      aria-hidden
    >
      <Body
        data={highlightData}
        gender={bodyGender}
        side="front"
        scale={scale}
        colors={HIGHLIGHT_COLORS}
        border="none"
      />
    </div>
  );
}

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
      <CompactMuscleMapBody
        highlightData={highlightData}
        bodyGender={bodyGender}
        className={className}
      />
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
