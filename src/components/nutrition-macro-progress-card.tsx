"use client";

import { Beef, Droplet, Flame, Wheat, type LucideIcon } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import type { MealMacros } from "@/lib/meal-utils";
import { cn } from "@/lib/utils";

const PROTEIN_KCAL = 4;
const CARBS_KCAL = 4;
const FAT_KCAL = 9;

type MacroRowKey = keyof MealMacros;

type MacroRow = {
  key: MacroRowKey;
  icon: LucideIcon;
  colorClass: string;
  barClass: string;
  unit: "kcal" | "g";
  label: string;
};

const RING_SIZE = 128;
const RING_STROKE = 10;
const RING_GAP = 3.5;

/** Segment colors matching the progress bars (calories / protein / carbs / fat). */
const SEGMENT_COLORS = {
  calories: "#f97316",
  protein: "#f43f5e",
  carbs: "#fbbf24",
  fat: "#0ea5e9",
} as const;

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

function MacroBarRow({
  icon: Icon,
  label,
  value,
  target,
  unit,
  colorClass,
  barClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  target: number;
  unit: "kcal" | "g";
  colorClass: string;
  barClass: string;
}) {
  const progress = target > 0 ? clamp01(value / target) : 0;
  const over = target > 0 && value > target;
  const roundedValue = Math.round(value);
  const roundedTarget = Math.round(target);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", colorClass)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] font-semibold leading-none text-foreground">
            {label}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums leading-none">
            <span className={cn("font-semibold", over ? "text-red-400" : "text-foreground")}>
              {roundedValue}
            </span>
            <span className="text-muted-foreground">
              {" "}
              / {roundedTarget} {unit}
            </span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10 dark:bg-foreground/15">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              over ? "bg-red-500" : barClass
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function buildRingSegments(current: MealMacros, filledCalories: number) {
  if (filledCalories <= 0) return [] as { color: string; weight: number }[];

  const proteinCal = Math.max(0, current.protein) * PROTEIN_KCAL;
  const carbsCal = Math.max(0, current.carbs) * CARBS_KCAL;
  const fatCal = Math.max(0, current.fat) * FAT_KCAL;
  const macroSum = proteinCal + carbsCal + fatCal;

  if (macroSum <= 0) {
    return [{ color: SEGMENT_COLORS.calories, weight: filledCalories }];
  }

  // ~12% rose accent (calories) + P/C/F split of the rest — mirrors the four bars.
  const accent = filledCalories * 0.12;
  const rest = filledCalories - accent;
  const scale = rest / macroSum;

  return [
    { color: SEGMENT_COLORS.calories, weight: accent },
    { color: SEGMENT_COLORS.protein, weight: proteinCal * scale },
    { color: SEGMENT_COLORS.carbs, weight: carbsCal * scale },
    { color: SEGMENT_COLORS.fat, weight: fatCal * scale },
  ].filter((s) => s.weight > 0.5);
}

function MacroCalorieRing({
  current,
  targets,
  caloriesLeftLabel,
}: {
  current: MealMacros;
  targets: MealMacros;
  caloriesLeftLabel: string;
}) {
  const target = Math.max(0, targets.calories);
  const consumed = Math.max(0, current.calories);
  const over = target > 0 && consumed > target;
  const fillRatio = target > 0 ? clamp01(consumed / target) : 0;
  const filledCalories = target > 0 ? Math.min(consumed, target) : 0;
  const segments = buildRingSegments(current, filledCalories);

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = RING_SIZE / 2;
  const fillLength = fillRatio * circumference;
  const gapCount = segments.length > 1 ? segments.length : 0;
  const usableFill = Math.max(0, fillLength - gapCount * RING_GAP);
  const segmentTotal = segments.reduce((sum, s) => sum + s.weight, 0);

  let cursor = 0;
  const arcs = segments.map((segment) => {
    const share = segmentTotal > 0 ? segment.weight / segmentTotal : 0;
    const length = usableFill * share;
    const offset = cursor;
    cursor += length + RING_GAP;
    return { color: segment.color, length, offset };
  });

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      aria-hidden
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          className="text-foreground/10 dark:text-foreground/15"
        />
        {arcs.map((arc, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(arc.length, 0.01)} ${circumference}`}
            strokeDashoffset={-arc.offset}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-500 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <p
          className={cn(
            "text-2xl font-black tabular-nums leading-none tracking-tight",
            over ? "text-red-400" : "text-foreground"
          )}
        >
          {Math.round(consumed)}
        </p>
        <p className="mt-1 text-[11px] tabular-nums leading-none text-muted-foreground">
          / {Math.round(target)} kcal
        </p>
        <p className="mt-2 max-w-[5.5rem] text-[9px] font-medium leading-tight text-muted-foreground">
          {over ? `+${Math.round(consumed - target)} kcal` : caloriesLeftLabel}
        </p>
      </div>
    </div>
  );
}

export function NutritionMacroProgressCard({
  current,
  targets,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const caloriesLabel =
    platform.nutrition.caloriesUnit.charAt(0).toUpperCase() +
    platform.nutrition.caloriesUnit.slice(1);

  const rows: MacroRow[] = [
    {
      key: "calories",
      icon: Flame,
      colorClass: "text-orange-400",
      barClass: "bg-orange-500",
      unit: "kcal",
      label: caloriesLabel,
    },
    {
      key: "protein",
      icon: Beef,
      colorClass: "text-rose-400",
      barClass: "bg-rose-500",
      unit: "g",
      label: platform.nutrition.proteinLeft,
    },
    {
      key: "carbs",
      icon: Wheat,
      colorClass: "text-amber-400",
      barClass: "bg-amber-400",
      unit: "g",
      label: platform.nutrition.carbsLeft,
    },
    {
      key: "fat",
      icon: Droplet,
      colorClass: "text-sky-400",
      barClass: "bg-sky-500",
      unit: "g",
      label: platform.nutrition.fatLeft,
    },
  ];

  return (
    <div
      className={cn(
        "pointer-events-none flex items-center gap-3 sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-2.5">
        {rows.map((row) => (
          <MacroBarRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            value={current[row.key]}
            target={targets[row.key]}
            unit={row.unit}
            colorClass={row.colorClass}
            barClass={row.barClass}
          />
        ))}
      </div>
      <MacroCalorieRing
        current={current}
        targets={targets}
        caloriesLeftLabel={platform.nutrition.caloriesLeft}
      />
    </div>
  );
}
