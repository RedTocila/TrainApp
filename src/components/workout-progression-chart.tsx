"use client";

import { format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import {
  computeWorkoutQualityProfile,
  type WorkoutQualityProfile,
} from "@/lib/workout-progression";
import type { WorkoutProgressionPoint } from "@/lib/actions/workout-sessions";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 140;
const PADDING = { top: 12, right: 12, bottom: 28, left: 36 };

const RADAR_SIZE = 220;
const RADAR_LEVELS = 5;
const RADAR_AXES = [
  "reps",
  "weight",
  "rest",
  "duration",
  "intensity",
] as const satisfies readonly (keyof WorkoutQualityProfile)[];

function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-secondary/80", className)} />
  );
}

export function WorkoutProgressionSkeleton() {
  return (
    <div
      className="space-y-2.5"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="h-4 w-40 rounded-md" />
      <div className="grid grid-cols-3 gap-1.5">
        <Pulse className="h-11 w-full rounded-lg" />
        <Pulse className="h-11 w-full rounded-lg" />
        <Pulse className="h-11 w-full rounded-lg" />
      </div>
      <Pulse className="h-3 w-full rounded-full" />
    </div>
  );
}

function kindDotClass(kind: WorkoutProgressionPoint["kind"]) {
  if (kind === "trained") return "bg-emerald-500";
  if (kind === "skipped") return "bg-orange-500";
  return "bg-muted-foreground/35";
}

function radarPoint(
  index: number,
  value: number,
  cx: number,
  cy: number,
  radius: number
) {
  const angle = -Math.PI / 2 + (index / RADAR_AXES.length) * Math.PI * 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

function WorkoutQualityRadar({
  quality,
  labels,
  ariaLabel,
}: {
  quality: WorkoutQualityProfile;
  labels: Record<(typeof RADAR_AXES)[number], string>;
  ariaLabel: string;
}) {
  const cx = RADAR_SIZE / 2;
  const cy = RADAR_SIZE / 2;
  const radius = RADAR_SIZE * 0.32;

  const gridPaths = useMemo(
    () =>
      Array.from({ length: RADAR_LEVELS }, (_, level) => {
        const t = (level + 1) / RADAR_LEVELS;
        const pts = RADAR_AXES.map((_, i) =>
          radarPoint(i, t * 100, cx, cy, radius)
        );
        return (
          pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
          " Z"
        );
      }),
    [cx, cy, radius]
  );

  const axisEnds = useMemo(
    () => RADAR_AXES.map((_, i) => radarPoint(i, 100, cx, cy, radius)),
    [cx, cy, radius]
  );

  const valuePoints = useMemo(
    () =>
      RADAR_AXES.map((key, i) => radarPoint(i, quality[key], cx, cy, radius)),
    [quality, cx, cy, radius]
  );

  const valuePath =
    valuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
    " Z";

  const labelPositions = useMemo(
    () =>
      RADAR_AXES.map((key, i) => {
        const tip = radarPoint(i, 100, cx, cy, radius * 1.28);
        return { key, ...tip };
      }),
    [cx, cy, radius]
  );

  return (
    <svg
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      className="mx-auto h-auto w-full max-w-[240px]"
      role="img"
      aria-label={ariaLabel}
    >
      {gridPaths.map((d, i) => (
        <path
          key={`grid-${i}`}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          className="text-foreground"
        />
      ))}

      {axisEnds.map((p, i) => (
        <line
          key={`axis-${i}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="currentColor"
          strokeOpacity={0.2}
          className="text-foreground"
        />
      ))}

      <path
        d={valuePath}
        fill="var(--primary)"
        fillOpacity={0.22}
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {valuePoints.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="var(--primary)"
          stroke="var(--background)"
          strokeWidth={1.5}
        />
      ))}

      {labelPositions.map(({ key, x, y }) => (
        <text
          key={key}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground/75 text-[9px] font-medium"
        >
          {labels[key]}
        </text>
      ))}
    </svg>
  );
}

export function WorkoutProgressionChart({
  points,
}: {
  points: WorkoutProgressionPoint[];
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    const recent = points.slice(-14);
    const trained = recent.filter((p) => p.kind === "trained");
    const skipped = recent.filter((p) => p.kind === "skipped");
    const rest = recent.filter((p) => p.kind === "rest");

    const firstScore = recent[0]?.score ?? 50;
    const lastScore = recent[recent.length - 1]?.score ?? 50;
    const delta = lastScore - firstScore;

    const trainedWithWeight = trained.filter(
      (p) => p.avgWeightKg != null && p.avgWeightKg > 0
    );
    const firstWeight = trainedWithWeight[0]?.avgWeightKg ?? null;
    const lastWeight =
      trainedWithWeight[trainedWithWeight.length - 1]?.avgWeightKg ?? null;

    let headline: string;
    if (trained.length === 0 && skipped.length === 0) {
      headline = platform.workout.progressionHeadlineNew;
    } else if (skipped.length >= 3) {
      headline = platform.workout.progressionHeadlineMissed;
    } else if (
      delta > 4 ||
      (firstWeight && lastWeight && lastWeight > firstWeight * 1.03)
    ) {
      headline = platform.workout.progressionHeadlineStronger;
    } else if (delta < -4 || skipped.length >= 2) {
      headline = platform.workout.progressionHeadlineOff;
    } else {
      headline = platform.workout.progressionHeadlineSteady;
    }

    return {
      headline,
      trainedCount: trained.length,
      skippedCount: skipped.length,
      restCount: rest.length,
      recent,
    };
  }, [points, platform]);

  const quality = useMemo(
    () => computeWorkoutQualityProfile(points),
    [points]
  );

  const qualityItems = useMemo(
    () =>
      [
        {
          key: "reps" as const,
          label: platform.workout.progressionQualityReps,
          hint: platform.workout.progressionQualityRepsHint,
          value: quality.reps,
        },
        {
          key: "weight" as const,
          label: platform.workout.progressionQualityWeight,
          hint: platform.workout.progressionQualityWeightHint,
          value: quality.weight,
        },
        {
          key: "rest" as const,
          label: platform.workout.progressionQualityRest,
          hint: platform.workout.progressionQualityRestHint,
          value: quality.rest,
        },
        {
          key: "duration" as const,
          label: platform.workout.progressionQualityDuration,
          hint: platform.workout.progressionQualityDurationHint,
          value: quality.duration,
        },
        {
          key: "intensity" as const,
          label: platform.workout.progressionQualityIntensity,
          hint: platform.workout.progressionQualityIntensityHint,
          value: quality.intensity,
        },
      ] as const,
    [platform, quality]
  );

  const radarLabels = useMemo(
    () => ({
      reps: platform.workout.progressionQualityReps,
      weight: platform.workout.progressionQualityWeight,
      rest: platform.workout.progressionQualityRest,
      duration: platform.workout.progressionQualityDuration,
      intensity: platform.workout.progressionQualityIntensity,
    }),
    [platform]
  );

  const scoreSeries = useMemo(() => points.slice(-21), [points]);

  const plot = useMemo(() => {
    if (scoreSeries.length === 0) return null;

    const values = scoreSeries.map((p) => p.score);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const spread = Math.max(8, maxV - minV);
    const yMin = Math.max(0, minV - spread * 0.15);
    const yMax = Math.min(100, maxV + spread * 0.15);

    const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const chartPoints = scoreSeries.map((point, i) => {
      const x =
        scoreSeries.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + (i / (scoreSeries.length - 1)) * innerW;
      const value = values[i];
      const y =
        PADDING.top + innerH - ((value - yMin) / (yMax - yMin || 1)) * innerH;
      return { x, y, point, value };
    });

    const linePath = chartPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const yTicks = 3;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const value = yMax - ((yMax - yMin) * i) / yTicks;
      const y = PADDING.top + (innerH * i) / yTicks;
      return { value, y };
    });

    const xLabelIndices =
      scoreSeries.length <= 4
        ? scoreSeries.map((_, i) => i)
        : [0, Math.floor(scoreSeries.length / 2), scoreSeries.length - 1];

    const first = values[0];
    const latest = values[values.length - 1];
    const change = latest - first;

    return {
      chartPoints,
      linePath,
      yLabels,
      xLabelIndices,
      latest,
      change,
    };
  }, [scoreSeries]);

  if (points.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-bold text-foreground">
          {summary.headline}
        </h3>
        {plot ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {Math.round(plot.latest)}
            {scoreSeries.length > 1 ? (
              <span
                className={cn(
                  "ml-1",
                  plot.change > 0
                    ? "text-emerald-500"
                    : plot.change < 0
                      ? "text-orange-400"
                      : "text-muted-foreground"
                )}
              >
                {plot.change === 0
                  ? "0"
                  : `${plot.change > 0 ? "+" : ""}${Math.round(plot.change)}`}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-center">
          <p className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.trainedCount}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {platform.workout.progressionTrained}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-center">
          <p className="text-sm font-black tabular-nums text-orange-500">
            {summary.skippedCount}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {platform.workout.progressionSkipped}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-center">
          <p className="text-sm font-black tabular-nums text-foreground">
            {summary.restCount}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {platform.workout.progressionRest}
          </p>
        </div>
      </div>

      <div className="flex gap-0.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {summary.recent.map((point) => (
          <div
            key={`${point.date}-${point.kind}`}
            className="flex w-5 shrink-0 flex-col items-center gap-0.5"
            title={`${format(parseISO(point.date), "MMM d")}`}
          >
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                kindDotClass(point.kind),
                point.kind === "rest" && "border border-border"
              )}
            />
          </div>
        ))}
      </div>

      {open ? (
        <div className="space-y-3 border-t border-border/50 pt-3">
          {plot ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {platform.workout.progressionScoreTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {platform.workout.progressionScoreHint}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">
                    {platform.workout.progressionLatest}:{" "}
                  </span>
                  <strong className="tabular-nums text-foreground">
                    {Math.round(plot.latest)}
                  </strong>
                  {scoreSeries.length > 1 ? (
                    <span
                      className={cn(
                        "ml-1.5 tabular-nums",
                        plot.change > 0
                          ? "text-emerald-500"
                          : plot.change < 0
                            ? "text-orange-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {plot.change === 0
                        ? "0"
                        : `${plot.change > 0 ? "+" : ""}${Math.round(plot.change)}`}
                    </span>
                  ) : null}
                </div>
              </div>

              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="h-auto w-full"
                role="img"
                aria-label={platform.workout.progressionChartAria}
              >
                {plot.yLabels.map(({ value, y }) => (
                  <g key={`${value}-${y}`}>
                    <line
                      x1={PADDING.left}
                      y1={y}
                      x2={CHART_WIDTH - PADDING.right}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity={0.15}
                      strokeDasharray="4 4"
                      className="text-foreground"
                    />
                    <text
                      x={PADDING.left - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-foreground/55 text-[10px]"
                    >
                      {Math.round(value)}
                    </text>
                  </g>
                ))}

                {plot.chartPoints.length > 1 ? (
                  <path
                    d={plot.linePath}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {plot.chartPoints.map(({ x, y, point, value }) => (
                  <g key={point.date}>
                    <circle
                      cx={x}
                      cy={y}
                      r={point.kind === "trained" ? 4 : 3}
                      fill={
                        point.kind === "skipped"
                          ? "var(--destructive, #ef4444)"
                          : "var(--background)"
                      }
                      stroke={
                        point.kind === "skipped"
                          ? "var(--destructive, #ef4444)"
                          : "var(--primary)"
                      }
                      strokeWidth={2}
                      strokeOpacity={point.kind === "rest" ? 0.45 : 1}
                    />
                    <title>
                      {format(parseISO(point.date), "MMM d")}:{" "}
                      {Math.round(value)}
                    </title>
                  </g>
                ))}

                {plot.xLabelIndices.map((i) => {
                  const { x } = plot.chartPoints[i];
                  const point = scoreSeries[i];
                  return (
                    <text
                      key={`${point.date}-x`}
                      x={x}
                      y={CHART_HEIGHT - 8}
                      textAnchor="middle"
                      className="fill-foreground/55 text-[10px]"
                    >
                      {format(parseISO(point.date), "MMM d")}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : null}

          <div className="space-y-3 border-t border-border/50 pt-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {platform.workout.progressionQualityTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {platform.workout.progressionQualityHint}
              </p>
            </div>

            <div className="grid items-center gap-4 sm:grid-cols-2">
              <ul className="space-y-2.5">
                {qualityItems.map((item) => (
                  <li key={item.key} className="flex gap-2.5">
                    <span className="mt-0.5 w-8 shrink-0 text-right text-xs font-bold tabular-nums text-primary">
                      {item.value}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {item.label}
                      </p>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {item.hint}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <WorkoutQualityRadar
                quality={quality}
                labels={radarLabels}
                ariaLabel={platform.workout.progressionQualityAria}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={open}
        >
          {open ? platform.pricing.hideDetails : platform.dashboard.moreDetails}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </div>
    </div>
  );
}
