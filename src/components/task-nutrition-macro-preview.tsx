"use client";

import { useEffect, useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import { NutritionMacroRings } from "@/components/nutrition-macro-rings";
import type { MealMacros } from "@/lib/meal-utils";
import {
  estimateDailyMicros,
  scoreDailyNutrition,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

function healthScoreTextColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

const COMPACT_RING_HEIGHT_PX = 44;

function HealthScoreCompact({
  score,
  before,
  after,
}: {
  score: number;
  before: string;
  after: string;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div
      className="flex w-full flex-col items-center gap-1.5 text-center"
      aria-label={`${before} ${after}: ${score}`}
    >
      <div
        className="flex w-full items-center justify-center"
        style={{ height: COMPACT_RING_HEIGHT_PX }}
      >
        <span
          className={cn(
            "text-lg font-black tabular-nums leading-none transition-colors duration-500 ease-out",
            revealed ? healthScoreTextColor(score) : "text-white"
          )}
        >
          {score}
        </span>
      </div>
      <span className="text-center text-[10px] font-semibold lowercase leading-tight text-muted-foreground">
        {before}
        <span className="block">{after}</span>
      </span>
      <span className="invisible text-[9px] font-semibold leading-none" aria-hidden>
        /0
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

  return (
    <NutritionMacroRings
      current={current}
      targets={targets}
      variant="compact"
      spread
      trailingSlot={
        showHealthScore && health ? (
          <HealthScoreCompact
            score={health.score}
            before={platform.nutrition.healthScoreInnerBefore}
            after={platform.nutrition.healthScoreInnerAfter}
          />
        ) : undefined
      }
      className={cn("pointer-events-none w-full", className)}
    />
  );
}
