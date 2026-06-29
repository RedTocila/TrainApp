"use client";

import {
  Beef,
  Candy,
  Droplets,
  Flame,
  FlaskConical,
  Leaf,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import type { MealMacros } from "@/lib/meal-utils";
import {
  DAILY_MICRO_TARGETS,
  estimateMealMicros,
  type DailyMicros,
} from "@/lib/nutrition-day-utils";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function macroCalories(macros: MealMacros) {
  return {
    protein: macros.protein * 4,
    carbs: macros.carbs * 4,
    fat: macros.fat * 9,
  };
}

function MacroDonut({ macros }: { macros: MealMacros }) {
  const split = macroCalories(macros);
  const total = split.protein + split.carbs + split.fat || 1;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: split.protein, color: "#f43f5e" },
    { value: split.carbs, color: "#f59e0b" },
    { value: split.fat, color: "#0ea5e9" },
  ];

  let offset = 0;

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-border/60"
        />
        {segments.map((segment, index) => {
          const length = (segment.value / total) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={index}
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <Flame className="mb-0.5 h-4 w-4 text-orange-400" />
        <span className="text-xl font-black leading-none">{macros.calories}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          kcal
        </span>
      </div>
    </div>
  );
}

type NutrientRow = {
  key: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  icon: LucideIcon;
  text: string;
  bar: string;
  track: string;
  overWhenHigh?: boolean;
};

function NutrientBar({ row }: { row: NutrientRow }) {
  const pct = row.target > 0 ? Math.min(100, (row.value / row.target) * 100) : 0;
  const over = row.overWhenHigh && row.target > 0 && row.value > row.target;
  const Icon = row.icon;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className={cn("inline-flex items-center gap-1.5 font-medium", row.text)}>
          <Icon className="h-3.5 w-3.5" />
          {row.label}
        </span>
        <span className={cn("font-semibold tabular-nums", over && "text-red-400")}>
          {Math.round(row.value)}
          <span className="text-muted-foreground">{row.unit}</span>
        </span>
      </div>
      <div className={cn("h-2 overflow-hidden rounded-full", row.track)}>
        <div
          className={cn(
            "h-full rounded-full transition-all",
            over ? "bg-red-500" : row.bar
          )}
          style={{ width: `${Math.max(pct, row.value > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export function MealMacroDiagram({
  macros,
  micros,
  targets,
  className,
}: {
  macros: MealMacros;
  micros?: DailyMicros;
  targets?: MealMacros;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const resolvedMicros = micros ?? estimateMealMicros(macros);
  const macroMax = Math.max(macros.protein, macros.carbs, macros.fat, 1);

  const macroRows: NutrientRow[] = [
    {
      key: "protein",
      label: platform.nutrition.proteinLeft,
      value: macros.protein,
      unit: "g",
      target: targets?.protein && targets.protein > 0 ? targets.protein : macroMax,
      icon: Beef,
      text: "text-rose-400",
      bar: "bg-rose-500",
      track: "bg-rose-500/15",
      overWhenHigh: Boolean(targets?.protein),
    },
    {
      key: "carbs",
      label: platform.nutrition.carbsLeft,
      value: macros.carbs,
      unit: "g",
      target: targets?.carbs && targets.carbs > 0 ? targets.carbs : macroMax,
      icon: Wheat,
      text: "text-amber-400",
      bar: "bg-amber-500",
      track: "bg-amber-500/15",
      overWhenHigh: Boolean(targets?.carbs),
    },
    {
      key: "fat",
      label: platform.nutrition.fatLeft,
      value: macros.fat,
      unit: "g",
      target: targets?.fat && targets.fat > 0 ? targets.fat : macroMax,
      icon: Droplets,
      text: "text-sky-400",
      bar: "bg-sky-500",
      track: "bg-sky-500/15",
      overWhenHigh: Boolean(targets?.fat),
    },
  ];

  const microRows: NutrientRow[] = [
    {
      key: "fiber",
      label: platform.nutrition.fiber,
      value: resolvedMicros.fiber,
      unit: "g",
      target: DAILY_MICRO_TARGETS.fiber,
      icon: Leaf,
      text: "text-lime-400",
      bar: "bg-lime-500",
      track: "bg-lime-500/15",
    },
    {
      key: "sugar",
      label: platform.nutrition.sugar,
      value: resolvedMicros.sugar,
      unit: "g",
      target: DAILY_MICRO_TARGETS.sugar,
      icon: Candy,
      text: "text-pink-400",
      bar: "bg-pink-500",
      track: "bg-pink-500/15",
      overWhenHigh: true,
    },
    {
      key: "sodium",
      label: platform.nutrition.sodium,
      value: resolvedMicros.sodium,
      unit: "mg",
      target: DAILY_MICRO_TARGETS.sodium,
      icon: FlaskConical,
      text: "text-indigo-400",
      bar: "bg-indigo-500",
      track: "bg-indigo-500/15",
      overWhenHigh: true,
    },
  ];

  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <MacroDonut macros={macros} />
          <div className="min-w-0 flex-1 space-y-2.5">
            {macroRows.map((row) => (
              <NutrientBar key={row.key} row={row} />
            ))}
          </div>
        </div>

        <div className="border-t border-border/70 pt-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {platform.nutrition.microNutrients}
          </p>
          <div className="space-y-2.5">
            {microRows.map((row) => (
              <NutrientBar key={row.key} row={row} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
