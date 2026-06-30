"use client";

import Body from "@mjcdev/react-body-highlighter";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  resolveBodyMapGender,
  resolveWorkoutMuscleHighlights,
  toBodyHighlighterData,
} from "@/lib/muscle-map-utils";
import { cn } from "@/lib/utils";

/** intensity 1 = secondary (orange), 2 = primary (red), 3 = supporting (gray) */
const HIGHLIGHT_COLORS = ["#FF9500", "#FF3B30", "#AEB4BC"] as const;
const BODY_RENDER_WIDTH = 200;
const BODY_RENDER_HEIGHT = 400;

function CompactMuscleMapBody({
  highlightData,
  bodyGender,
  side,
  className,
}: {
  highlightData: ReturnType<typeof toBodyHighlighterData>;
  bodyGender: "male" | "female";
  side: "front" | "back";
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
      setScale(Math.max(0.3, fitScale * 1.1));
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
        "flex h-full w-full min-h-[10.5rem] max-h-[12rem] items-center justify-center sm:min-h-[11rem] sm:max-h-[12.5rem]",
        className
      )}
      aria-hidden
    >
      <Body
        data={highlightData}
        gender={bodyGender}
        side={side}
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
    const highlights = resolveWorkoutMuscleHighlights(exercises, dayTitle);
    return toBodyHighlighterData(highlights);
  }, [exercises, dayTitle]);

  if (exercises.length === 0 || highlightData.length === 0) {
    return null;
  }

  const legend = (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#FF3B30]" aria-hidden />
        Main focus (75–100%)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#FF9500]" aria-hidden />
        Secondary (40–75%)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#AEB4BC]" aria-hidden />
        Supporting (10–40%)
      </span>
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="grid w-full grid-cols-2 gap-1">
          <CompactMuscleMapBody
            highlightData={highlightData}
            bodyGender={bodyGender}
            side="front"
          />
          <CompactMuscleMapBody
            highlightData={highlightData}
            bodyGender={bodyGender}
            side="back"
          />
        </div>
        {legend}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
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
      {legend}
    </div>
  );
}
