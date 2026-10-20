"use client";

import { Camera, Utensils } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  DashboardStatusIcon,
  type DashboardStatusKind,
} from "@/components/section-completed-badge";
import type { MealMacros } from "@/lib/meal-utils";

/** Same macro palette as the rest of Rutina: amber carbs, rose protein, sky fat. */
const MACRO_CHIPS: {
  key: "carbs" | "protein" | "fat";
  labelKey: "carbsLeft" | "proteinLeft" | "fatLeft";
  color: string;
}[] = [
  { key: "carbs", labelKey: "carbsLeft", color: "#fbbf24" },
  { key: "protein", labelKey: "proteinLeft", color: "#f43f5e" },
  { key: "fat", labelKey: "fatLeft", color: "#0ea5e9" },
];

const CALORIE_COLOR = "#f97316";

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

function SemiGauge({ ratio }: { ratio: number }) {
  const clamped = clamp01(ratio);
  const r = 86;
  const cx = 110;
  const cy = 108;
  const length = Math.PI * r;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg viewBox="0 0 220 124" className="w-full" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={CALORIE_COLOR}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(length * clamped, clamped > 0 ? 1 : 0)} ${length}`}
      />
    </svg>
  );
}

function MacroDonut({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const size = 34;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = clamp01(progress);
  const center = size / 2;

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={0.28}
        strokeWidth={stroke}
      />
      {clamped > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(c * clamped, 0.5)} ${c}`}
        />
      ) : null}
    </svg>
  );
}

export function NutritionRemainingCard({
  current,
  targets,
  onLogMeal,
  status,
  statusLabel,
}: {
  current: MealMacros;
  targets: MealMacros;
  onLogMeal?: () => void;
  status?: DashboardStatusKind;
  statusLabel?: string;
}) {
  const platform = usePlatformCopy();
  const calorieTarget = Math.max(0, targets.calories);
  const calorieCurrent = Math.max(0, current.calories);
  const over = calorieTarget > 0 && calorieCurrent > calorieTarget;
  const remaining = Math.max(0, Math.round(calorieTarget - calorieCurrent));
  const display = over ? Math.round(calorieCurrent - calorieTarget) : remaining;
  const ratio = calorieTarget > 0 ? remaining / calorieTarget : 0;

  return (
    <div className="flex flex-col gap-1 px-3.5 pb-3.5 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Utensils className="h-4 w-4 text-emerald-300" aria-hidden />
          </span>
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
            {platform.nutrition.remainingToday}
          </span>
          {status ? (
            <DashboardStatusIcon status={status} aria-label={statusLabel} />
          ) : null}
        </div>
        {onLogMeal ? (
          <button
            type="button"
            onClick={onLogMeal}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/30"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {platform.nutrition.logMeal}
          </button>
        ) : null}
      </div>

      <div className="relative mx-auto mt-1 w-full max-w-[17.5rem]">
        <SemiGauge ratio={ratio} />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p
            className={`text-[2.65rem] font-black tabular-nums leading-none tracking-tight ${
              over ? "text-red-400" : "text-white"
            }`}
          >
            {display.toLocaleString()}
          </p>
          <p className="mt-1 text-sm font-medium text-white/70">
            {platform.nutrition.kcal}
          </p>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {MACRO_CHIPS.map((chip) => {
          const value = Math.max(0, current[chip.key]);
          const target = Math.max(0, targets[chip.key]);
          const progress = target > 0 ? value / target : 0;
          return (
            <div
              key={chip.key}
              className="flex min-w-0 items-center gap-1.5 rounded-2xl bg-white/[0.07] px-1.5 py-2"
            >
              <MacroDonut progress={progress} color={chip.color} />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold leading-tight text-white">
                  {platform.nutrition[chip.labelKey]}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums leading-tight text-white/65">
                  {Math.round(value)}/{Math.round(target)} g
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
