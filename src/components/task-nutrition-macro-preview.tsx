"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { NutritionMacroProgressCard } from "@/components/nutrition-macro-progress-card";
import type { MealMacros } from "@/lib/meal-utils";
import {
  estimateDailyMicros,
  scoreDailyNutrition,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

function healthScoreRingColor(score: number) {
  if (score >= 70) return "text-green-500";
  if (score >= 55) return "text-orange-500";
  return "text-red-500";
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

  if (showHealthScore) {
    const micros = estimateDailyMicros(dailyMeals, current);
    const health = scoreDailyNutrition({
      current,
      targets,
      waterMl,
      waterGoalMl,
      dateKey: dateKey ?? new Date().toISOString().slice(0, 10),
      mealCount: dailyMeals.length,
      micros,
    });
    const scoreColor = healthScoreRingColor(health.score);

    return (
      <div
        className={cn("pointer-events-none shrink-0", className)}
        aria-label={`${platform.nutrition.healthScore}: ${health.score}`}
      >
        <ScoreGauge
          score={health.score}
          label=""
          colorClass={scoreColor}
          size="xs"
        />
      </div>
    );
  }

  return (
    <NutritionMacroProgressCard
      current={current}
      targets={targets}
      className={cn("w-full", className)}
    />
  );
}
