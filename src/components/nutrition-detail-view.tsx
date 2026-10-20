"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import { MacroOverageInsightButton } from "@/components/macro-overage-insight-button";
import type { MealMacros } from "@/lib/meal-utils";
import { macroOverageSeverity } from "@/lib/macro-targets";
import type { OverageNutrient } from "@/lib/macro-overage-local";
import type { DailyMicros, NutritionDayContext } from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Same macro palette as the rest of Rutina: rose protein, amber carbs, sky fat. */
const PAGE_MACROS: {
  key: "protein" | "carbs" | "fat";
  labelKey: "proteinLeft" | "carbsLeft" | "fatLeft";
  color: string;
}[] = [
  { key: "protein", labelKey: "proteinLeft", color: "#f43f5e" },
  { key: "carbs", labelKey: "carbsLeft", color: "#fbbf24" },
  { key: "fat", labelKey: "fatLeft", color: "#0ea5e9" },
];

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

function formatWaterAmount(ml: number) {
  const safe = Math.max(0, Math.round(ml));
  if (safe >= 1000) {
    const liters = Math.round((safe / 1000) * 10) / 10;
    return `${liters.toFixed(1)}L`;
  }
  return `${safe}`;
}

function RemainingCalorieRing({ ratio }: { ratio: number }) {
  const size = 232;
  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const clamped = clamp01(ratio);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-foreground/15"
      />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="text-orange-500"
        strokeDasharray={`${Math.max(c * clamped, clamped > 0 ? 1 : 0)} ${c}`}
      />
    </svg>
  );
}

export function NutritionDetailView({
  current,
  targets,
  context,
  meals = [],
  waterMl = 0,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  micros: DailyMicros;
  context: NutritionDayContext;
  meals?: DailyMealLog[];
  waterMl?: number;
  waterGoalMl?: number;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const calorieTarget = Math.max(0, targets.calories);
  const calorieCurrent = Math.max(0, current.calories);
  const over = calorieTarget > 0 && calorieCurrent > calorieTarget;
  const remaining = Math.max(0, calorieTarget - calorieCurrent);
  const display = over ? calorieCurrent - calorieTarget : remaining;
  const ratio = calorieTarget > 0 ? calorieCurrent / calorieTarget : 0;
  const calorieTone = macroOverageSeverity(
    current.calories,
    targets.calories,
    "calories"
  );

  const insightButton = (nutrient: OverageNutrient) =>
    meals.length > 0 ? (
      <MacroOverageInsightButton
        nutrient={nutrient}
        dateKey={context.dateKey}
        current={current}
        targets={targets}
        meals={meals}
        severity="alert"
      />
    ) : null;

  return (
    <div className={cn("space-y-6", className)}>
      <h1 className="hidden text-3xl font-black tracking-tight lg:block">
        {platform.nutrition.title}
      </h1>

      <div className="flex flex-col items-center max-lg:!mt-0">
        <div className="relative h-[232px] w-[232px]">
          <RemainingCalorieRing ratio={ratio} />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {platform.nutrition.remaining}
            </p>
            <p
              className={cn(
                "mt-1 text-5xl font-black tabular-nums leading-none tracking-tight",
                over && "text-red-400"
              )}
            >
              {Math.round(display).toLocaleString()}
            </p>
            <p className="mt-1.5 text-sm font-medium text-orange-400">
              {over
                ? platform.nutrition.caloriesStatusOver
                : platform.nutrition.ofKcal(calorieTarget)}
            </p>
            {calorieTone === "alert" ? (
              <div className="mt-2">{insightButton("calories")}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="border-r border-border/70 px-3 text-center">
          <p className="text-2xl font-black tabular-nums leading-none">
            {Math.round(calorieCurrent).toLocaleString()}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {platform.nutrition.eaten}
          </p>
        </div>
        <div className="px-3 text-center">
          <p className="text-2xl font-black tabular-nums leading-none">
            {formatWaterAmount(waterMl)}
            {waterMl < 1000 ? (
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                ml
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {platform.nutrition.water}
          </p>
        </div>
      </div>

      <div className="dashboard-photo-card space-y-4 rounded-3xl border border-white/10 bg-zinc-950 px-4 py-4 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]">
        {PAGE_MACROS.map((macro) => {
          const value = Math.max(0, current[macro.key]);
          const target = Math.max(0, targets[macro.key]);
          const progress = target > 0 ? clamp01(value / target) : 0;
          const tone = macroOverageSeverity(value, target, macro.key);
          return (
            <div key={macro.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: macro.color }}
                    aria-hidden
                  />
                  <span className="truncate">{platform.nutrition[macro.labelKey]}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                  <span className={cn("font-semibold", tone !== "ok" && "text-red-400")}>
                    {Math.round(value)}
                  </span>
                  <span className="text-muted-foreground">
                    / {Math.round(target)} g
                  </span>
                  {tone === "alert" ? insightButton(macro.key) : null}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${progress * 100}%`,
                    background: tone === "alert" ? "#f87171" : macro.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
