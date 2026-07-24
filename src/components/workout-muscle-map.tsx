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

export function MuscleMapLegend({
  className,
  layout = "row",
}: {
  className?: string;
  layout?: "row" | "column";
}) {
  const platform = usePlatformCopy();

  return (
    <div
      className={cn(
        "text-[10px] text-muted-foreground",
        layout === "row"
          ? "flex flex-nowrap items-center gap-x-3 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-1.5",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" aria-hidden />
        {platform.workout.muscleMapMain}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9500]" aria-hidden />
        {platform.workout.muscleMapSecond}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#AEB4BC]" aria-hidden />
        {platform.workout.muscleMapSupport}
      </span>
    </div>
  );
}

function CompactMuscleMapBody({
  highlightData,
  bodyGender,
  side,
  className,
  minHeightClass = "min-h-[7.5rem] max-h-[8.5rem] sm:min-h-[8rem] sm:max-h-[9rem]",
}: {
  highlightData: ReturnType<typeof toBodyHighlighterData>;
  bodyGender: "male" | "female";
  side: "front" | "back";
  className?: string;
  minHeightClass?: string;
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
      setScale(Math.max(0.28, fitScale * 1.05));
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
        "flex h-full w-full items-center justify-center",
        minHeightClass,
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
  showLegend = true,
}: {
  exercises: { name: string }[];
  dayTitle?: string;
  gender?: string | null;
  className?: string;
  variant?: "full" | "compact" | "hero";
  showLegend?: boolean;
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

  if (variant === "hero") {
    return (
      <div className={cn("grid w-full grid-cols-2 gap-0.5", className)}>
        <CompactMuscleMapBody
          highlightData={highlightData}
          bodyGender={bodyGender}
          side="front"
          minHeightClass="min-h-[8.5rem] max-h-[10rem]"
        />
        <CompactMuscleMapBody
          highlightData={highlightData}
          bodyGender={bodyGender}
          side="back"
          minHeightClass="min-h-[8.5rem] max-h-[10rem]"
        />
      </div>
    );
  }

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
        {showLegend ? <MuscleMapLegend /> : null}
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
      {showLegend ? <MuscleMapLegend /> : null}
    </div>
  );
}
