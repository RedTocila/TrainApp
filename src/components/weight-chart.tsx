"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { useBodyUnits } from "@/components/locale-provider";
import { kgToLb } from "@/lib/body-units";
import type { BodyWeightLog } from "@/lib/types";

interface WeightChartProps {
  entries: BodyWeightLog[];
  highlightDate?: string;
  startWeightKg?: number | null;
  startDate?: string | null;
}

const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 32, left: 44 };
const START_POINT_ID = "intake-start";

function buildChartEntries(
  entries: BodyWeightLog[],
  startWeightKg?: number | null,
  startDate?: string | null
): { entries: BodyWeightLog[]; startEntryId: string | null } {
  if (!startWeightKg || !startDate) {
    return { entries, startEntryId: null };
  }

  const hasMatchingStart = entries.some(
    (entry) =>
      entry.date === startDate &&
      Math.abs(Number(entry.weight_kg) - startWeightKg) < 0.05
  );
  if (hasMatchingStart) {
    return { entries, startEntryId: null };
  }

  const startEntry: BodyWeightLog = {
    id: START_POINT_ID,
    client_id: "",
    date: startDate,
    weight_kg: startWeightKg,
    created_at: startDate,
  };

  const merged = [...entries, startEntry].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { entries: merged, startEntryId: START_POINT_ID };
}

export function WeightChart({
  entries,
  highlightDate,
  startWeightKg,
  startDate,
}: WeightChartProps) {
  const units = useBodyUnits();

  const formatWeight = (kg: number) => units.formatWeightKg(kg);
  const formatWeightWithUnit = (kg: number) => units.formatWeightKgWithUnit(kg);

  const { entries: chartEntries, startEntryId } = useMemo(
    () => buildChartEntries(entries, startWeightKg, startDate),
    [entries, startWeightKg, startDate]
  );

  const plot = useMemo(() => {
    if (chartEntries.length === 0) return null;

    const weights = chartEntries.map((e) => Number(e.weight_kg));
    const displayWeights = weights.map((kg) =>
      units.unitSystem === "imperial" ? kgToLb(kg) : kg
    );
    const minW = Math.min(...displayWeights);
    const maxW = Math.max(...displayWeights);
    const spread = maxW - minW || 2;
    const yMin = minW - spread * 0.15;
    const yMax = maxW + spread * 0.15;

    const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const points = chartEntries.map((entry, i) => {
      const x =
        chartEntries.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + (i / (chartEntries.length - 1)) * innerW;
      const w = Number(entry.weight_kg);
      const displayW =
        units.unitSystem === "imperial" ? kgToLb(w) : w;
      const y =
        PADDING.top + innerH - ((displayW - yMin) / (yMax - yMin)) * innerH;
      return {
        x,
        y,
        entry,
        weight: w,
        displayWeight: displayW,
        isStart: entry.id === startEntryId,
      };
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
      chartEntries.length <= 5
        ? chartEntries.map((_, i) => i)
        : [0, Math.floor(chartEntries.length / 2), chartEntries.length - 1];

    return { points, linePath, yLabels, xLabelIndices, yMin, yMax };
  }, [chartEntries, startEntryId, units.unitSystem]);

  if (!plot) {
    if (startWeightKg && startDate) {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span>
              Starting weight:{" "}
              <strong className="text-foreground">
                {formatWeightWithUnit(Number(startWeightKg))}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Log weigh-ins to see your trend
            </span>
          </div>
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
            Your chart will appear after your first log
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
        Log your weight to see your progress
      </div>
    );
  }

  const { points, linePath, yLabels, xLabelIndices } = plot;
  const latest = chartEntries[chartEntries.length - 1];
  const first = chartEntries[0];
  const change = Number(latest.weight_kg) - Number(first.weight_kg);
  const changeDisplay =
    units.unitSystem === "imperial" ? kgToLb(change) : change;
  const changeText =
    changeDisplay === 0
      ? `0 ${units.weightUnit}`
      : `${changeDisplay > 0 ? "+" : ""}${formatWeight(Math.abs(changeDisplay))} ${units.weightUnit}`;
  const changeLabel =
    first.id === startEntryId
      ? "since start"
      : `since ${format(parseISO(first.date), "MMM d")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>
          Latest:{" "}
          <strong className="text-foreground">
            {formatWeightWithUnit(Number(latest.weight_kg))}
          </strong>
        </span>
        {chartEntries.length > 1 && (
          <span
            className={
              change < 0
                ? "text-emerald-400"
                : change > 0
                  ? "text-orange-400"
                  : "text-muted-foreground"
            }
          >
            {changeText} {changeLabel}
          </span>
        )}
        {startWeightKg && startEntryId && (
          <span className="text-muted-foreground">
            Start: {formatWeightWithUnit(Number(startWeightKg))}
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

        {points.map(({ x, y, entry, weight, isStart }) => {
          const highlighted = highlightDate === entry.date;
          return (
            <g key={entry.id}>
              <circle
                cx={x}
                cy={y}
                r={highlighted || isStart ? 6 : 4}
                fill={
                  isStart
                    ? "var(--card)"
                    : highlighted
                      ? "var(--primary)"
                      : "var(--card)"
                }
                stroke={isStart ? "var(--muted-foreground)" : "var(--primary)"}
                strokeWidth={2}
                strokeDasharray={isStart ? "3 2" : undefined}
              />
              <title>
                {isStart ? "Start" : format(parseISO(entry.date), "MMM d, yyyy")}:{" "}
                {formatWeightWithUnit(weight)}
              </title>
            </g>
          );
        })}

        {xLabelIndices.map((i) => {
          const { x, isStart } = points[i];
          const entry = chartEntries[i];
          return (
            <text
              key={entry.id}
              x={x}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {isStart ? "Start" : format(parseISO(entry.date), "MMM d")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
