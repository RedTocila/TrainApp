"use client";

import Body from "@mjcdev/react-body-highlighter";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  resolveBodyMapGender,
  resolveMuscleMapView,
  resolveWorkoutMuscleHighlights,
  toBodyHighlighterData,
} from "@/lib/muscle-map-utils";
import { cn } from "@/lib/utils";

/** intensity 1 = secondary (orange), 2 = primary (red), 3 = supporting (gray) */
const HIGHLIGHT_COLORS = ["#FF9500", "#FF3B30", "#AEB4BC"] as const;
const BODY_RENDER_WIDTH = 200;
const BODY_RENDER_HEIGHT = 400;

/**
 * `@mjcdev/react-body-highlighter` resolves default fills from
 * `prefers-color-scheme` at module load (SSR always "light"). Render only after
 * mount so server HTML and client hydration never disagree on path fills.
 */
function ClientOnlyBody(props: ComponentProps<typeof Body>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <Body {...props} />;
}

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
      <ClientOnlyBody
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
  bodyMinHeightClass,
}: {
  exercises: { name: string }[];
  dayTitle?: string;
  gender?: string | null;
  className?: string;
  variant?: "full" | "compact" | "hero";
  showLegend?: boolean;
  /** Override default map body height (compact / hero). */
  bodyMinHeightClass?: string;
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
    const height =
      bodyMinHeightClass ?? "min-h-[8.5rem] max-h-[10rem]";
    return (
      <div className={cn("grid w-full grid-cols-2 gap-0.5", className)}>
        <CompactMuscleMapBody
          highlightData={highlightData}
          bodyGender={bodyGender}
          side="front"
          minHeightClass={height}
        />
        <CompactMuscleMapBody
          highlightData={highlightData}
          bodyGender={bodyGender}
          side="back"
          minHeightClass={height}
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
            minHeightClass={bodyMinHeightClass}
          />
          <CompactMuscleMapBody
            highlightData={highlightData}
            bodyGender={bodyGender}
            side="back"
            minHeightClass={bodyMinHeightClass}
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
          <ClientOnlyBody
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
          <ClientOnlyBody
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

/**
 * One body view, cropped so the working muscle fills the card center.
 * The rest of the figure may extend past the card.
 */
export function FocusedWorkoutMuscleMap({
  exercises,
  dayTitle,
  gender,
  className,
}: {
  exercises: { name: string }[];
  dayTitle?: string;
  gender?: string | null;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("translate(0px, 0px) scale(1)");
  const [ready, setReady] = useState(false);
  const bodyGender = resolveBodyMapGender(gender);

  const highlights = useMemo(
    () => resolveWorkoutMuscleHighlights(exercises, dayTitle),
    [exercises, dayTitle]
  );
  const view = useMemo(
    () => resolveMuscleMapView(highlights, dayTitle),
    [highlights, dayTitle]
  );
  const { side, focus: focusSlugs } = view;
  const highlightData = useMemo(() => {
    const data = toBodyHighlighterData(highlights);
    const bySlug = new Map(data.map((item) => [item.slug, item.intensity]));
    for (const slug of focusSlugs) {
      const current = bySlug.get(slug) ?? 0;
      if (current < 2) bySlug.set(slug, 2);
    }
    return [...bySlug.entries()].map(([slug, intensity]) => ({
      slug,
      intensity,
    }));
  }, [focusSlugs, highlights]);
  const focusKey = focusSlugs.join(",");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || highlightData.length === 0) return;

    let cancelled = false;
    let attempts = 0;
    let raf = 0;

    const fit = () => {
      if (cancelled) return false;
      const svg = frame.querySelector("svg");
      if (!svg) return false;

      const viewBox = svg.viewBox.baseVal;
      const svgW = svg.width.baseVal.value;
      const svgH = svg.height.baseVal.value;
      if (viewBox.width < 1 || viewBox.height < 1 || svgW < 1 || svgH < 1) {
        return false;
      }

      const focus = new Set(focusSlugs);
      const highlighted = new Set(highlightData.map((item) => item.slug));
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      svg.querySelectorAll("path").forEach((path) => {
        const id = path.id;
        if (focus.has(id as (typeof focusSlugs)[number])) {
          const box = path.getBBox();
          if (box.width > 0 || box.height > 0) {
            minX = Math.min(minX, box.x);
            minY = Math.min(minY, box.y);
            maxX = Math.max(maxX, box.x + box.width);
            maxY = Math.max(maxY, box.y + box.height);
          }
        }
        path.style.opacity = focus.has(id as (typeof focusSlugs)[number])
          ? "1"
          : highlighted.has(id as (typeof focusSlugs)[number])
            ? "0.22"
            : "0.08";
      });

      const frameW = frame.clientWidth;
      const frameH = frame.clientHeight;
      if (frameW < 1 || frameH < 1 || !Number.isFinite(minX)) return false;

      const boxW = Math.max(maxX - minX, viewBox.width * 0.08);
      const boxH = Math.max(maxY - minY, viewBox.height * 0.06);
      const padX = Math.max(boxW * 0.28, viewBox.width * 0.035);
      const padY = Math.max(boxH * 0.32, viewBox.height * 0.03);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const relW = (boxW + padX * 2) / viewBox.width;
      const relH = (boxH + padY * 2) / viewBox.height;
      const muscleW = relW * svgW;
      const muscleH = relH * svgH;
      const scale = Math.min((frameH * 0.94) / muscleH, (frameW * 0.96) / muscleW);
      const clamped = Math.max(1.05, Math.min(scale, 4.1));
      const muscleCx = ((cx - viewBox.x) / viewBox.width) * svgW;
      const muscleCy = ((cy - viewBox.y) / viewBox.height) * svgH;
      const originX = frameW * 0.5 - muscleCx * clamped;
      const originY = frameH * 0.5 - muscleCy * clamped;
      const next = `translate(${originX.toFixed(1)}px, ${originY.toFixed(1)}px) scale(${clamped.toFixed(3)})`;

      setTransform((prev) => (prev === next ? prev : next));
      setReady(true);
      return true;
    };

    const waitForSvg = () => {
      if (cancelled) return;
      if (fit()) return;
      attempts += 1;
      if (attempts >= 48) return;
      raf = window.requestAnimationFrame(waitForSvg);
    };
    if (!fit()) waitForSvg();

    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(frame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [bodyGender, focusKey, focusSlugs, highlightData, side]);

  if (exercises.length === 0 || highlightData.length === 0) return null;

  return (
    <div
      ref={frameRef}
      className={cn(
        "pointer-events-none absolute right-5 top-1/2 z-0 h-[100%] w-[46%] -translate-y-1/2 overflow-visible sm:right-6 sm:w-[42%]",
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute left-0 top-0 will-change-transform",
          ready ? "opacity-100" : "opacity-0"
        )}
        style={{ transform, transformOrigin: "0 0" }}
      >
        <ClientOnlyBody
          data={highlightData}
          gender={bodyGender}
          side={side}
          scale={1}
          colors={HIGHLIGHT_COLORS}
          border="none"
        />
      </div>
    </div>
  );
}
