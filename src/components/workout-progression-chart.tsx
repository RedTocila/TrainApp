"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import type { WorkoutProgressionPoint } from "@/lib/actions/workout-sessions";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 140;
const PADDING = { top: 12, right: 12, bottom: 28, left: 36 };

function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-secondary/80", className)} />
  );
}

export function WorkoutProgressionSkeleton() {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="h-5 w-48 rounded-md" />
      <div className="grid grid-cols-3 gap-2">
        <Pulse className="h-12 w-full rounded-lg" />
        <Pulse className="h-12 w-full rounded-lg" />
        <Pulse className="h-12 w-full rounded-lg" />
      </div>
      <Pulse className="h-10 w-full rounded-lg" />
      <Pulse className="h-36 w-full rounded-xl" />
    </div>
  );
}

function kindDotClass(kind: WorkoutProgressionPoint["kind"]) {
  if (kind === "trained") return "bg-emerald-500";
  if (kind === "skipped") return "bg-orange-500";
  return "bg-muted-foreground/35";
}

export function WorkoutProgressionChart({
  points,
}: {
  points: WorkoutProgressionPoint[];
}) {
  const platform = usePlatformCopy();

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
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">{summary.headline}</h3>

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
      </div>

      {plot ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
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
                      : point.kind === "rest"
                        ? "var(--background)"
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
                  {format(parseISO(point.date), "MMM d")}: {Math.round(value)}
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
    </div>
  );
}
