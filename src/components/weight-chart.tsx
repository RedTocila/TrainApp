"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import type { BodyWeightLog } from "@/lib/types";

interface WeightChartProps {
  entries: BodyWeightLog[];
  highlightDate?: string;
}

const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 32, left: 44 };

export function WeightChart({ entries, highlightDate }: WeightChartProps) {
  const plot = useMemo(() => {
    if (entries.length === 0) return null;

    const weights = entries.map((e) => Number(e.weight_kg));
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const spread = maxW - minW || 2;
    const yMin = minW - spread * 0.15;
    const yMax = maxW + spread * 0.15;

    const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const points = entries.map((entry, i) => {
      const x =
        entries.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + (i / (entries.length - 1)) * innerW;
      const w = Number(entry.weight_kg);
      const y =
        PADDING.top + innerH - ((w - yMin) / (yMax - yMin)) * innerH;
      return { x, y, entry, weight: w };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const yTicks = 4;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const value = yMax - ((yMax - yMin) * i) / yTicks;
      const y = PADDING.top + (innerH * i) / yTicks;
      return { value, y };
    });

    const xLabelIndices =
      entries.length <= 5
        ? entries.map((_, i) => i)
        : [0, Math.floor(entries.length / 2), entries.length - 1];

    return { points, linePath, yLabels, xLabelIndices, yMin, yMax };
  }, [entries]);

  if (!plot) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
        Log your weight to see your progress
      </div>
    );
  }

  const { points, linePath, yLabels, xLabelIndices } = plot;
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const change = Number(latest.weight_kg) - Number(first.weight_kg);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>
          Latest:{" "}
          <strong className="text-foreground">
            {Number(latest.weight_kg).toFixed(1)} kg
          </strong>
        </span>
        {entries.length > 1 && (
          <span
            className={
              change < 0
                ? "text-emerald-400"
                : change > 0
                  ? "text-orange-400"
                  : "text-muted-foreground"
            }
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)} kg since{" "}
            {format(parseISO(first.date), "MMM d")}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Body weight trend chart"
      >
        {yLabels.map(({ value, y }) => (
          <g key={value}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={CHART_WIDTH - PADDING.right}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <text
              x={PADDING.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}

        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map(({ x, y, entry, weight }) => {
          const highlighted = highlightDate === entry.date;
          return (
            <g key={entry.id}>
              <circle
                cx={x}
                cy={y}
                r={highlighted ? 6 : 4}
                fill={highlighted ? "var(--primary)" : "var(--card)"}
                stroke="var(--primary)"
                strokeWidth={2}
              />
              <title>
                {format(parseISO(entry.date), "MMM d, yyyy")}: {weight.toFixed(1)} kg
              </title>
            </g>
          );
        })}

        {xLabelIndices.map((i) => {
          const { x } = points[i];
          const entry = entries[i];
          return (
            <text
              key={entry.id}
              x={x}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {format(parseISO(entry.date), "MMM d")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
