"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import { NutritionMacroRings } from "@/components/nutrition-macro-rings";
import type { MealMacros } from "@/lib/meal-utils";
import {
  estimateDailyMicros,
  scoreDailyNutrition,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

function healthScoreBarColor(score: number) {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-lime-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

function HealthScoreBarGauge({
  score,
  before,
  after,
  className,
}: {
  score: number;
  before: string;
  after: string;
  className?: string;
}) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const fillColor = healthScoreBarColor(score);

  return (
    <div
      className={cn("flex shrink-0 flex-col items-center gap-1", className)}
      aria-label={`${before} ${after}: ${score}`}
    >
      <div className="relative flex h-[4.5rem] w-11 items-end overflow-hidden rounded-lg border border-border/60 bg-secondary/50 p-0.5">
        <div
          className={cn(
            "w-full rounded-md transition-[height] duration-500 ease-out",
            fillColor
          )}
          style={{ height: `${Math.max(pct * 100, 8)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums leading-none text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
          {score}
        </span>
      </div>
      <span className="max-w-[3rem] text-center text-[8px] font-semibold lowercase leading-tight text-muted-foreground">
        {before}
        <span className="block">{after}</span>
      </span>
    </div>
  );
}

export function TaskNutritionMacroPreview({
  current,
  targets,
  dailyMeals = [],
  waterMl = 0,
  waterGoalMl = 2500,
  dateKey,
  showHealthScore = true,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  dailyMeals?: DailyMealLog[];
  waterMl?: number;
  waterGoalMl?: number;
  dateKey?: string;
  showHealthScore?: boolean;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const micros = showHealthScore ? estimateDailyMicros(dailyMeals, current) : null;
  const health =
    showHealthScore && micros
      ? scoreDailyNutrition({
          current,
          targets,
          waterMl,
          waterGoalMl,
          dateKey: dateKey ?? new Date().toISOString().slice(0, 10),
          mealCount: dailyMeals.length,
          micros,
        })
      : null;

  const macroRings = (
    <NutritionMacroRings
      current={current}
      targets={targets}
      variant="compact"
      spread
      className="pointer-events-none w-full"
    />
  );

  if (!showHealthScore) {
    return <div className={cn("w-full", className)}>{macroRings}</div>;
  }

  return (
    <div
      className={cn(
        "flex w-full items-end justify-between gap-5 px-2 sm:gap-6 sm:px-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">{macroRings}</div>
      <HealthScoreBarGauge
        score={health!.score}
        before={platform.nutrition.healthScoreInnerBefore}
        after={platform.nutrition.healthScoreInnerAfter}
        className="pb-3"
      />
    </div>
  );
}
