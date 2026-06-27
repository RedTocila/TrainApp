"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { NutritionMacroRings } from "@/components/nutrition-macro-rings";
import type { NutritionDayContext } from "@/lib/nutrition-day-utils";
import {
  estimateDailyMicros,
  scoreDailyNutrition,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NutritionDayMetrics({
  meals,
  context,
  compact = false,
  scoreOnly = false,
  className,
}: {
  meals: DailyMealLog[];
  context: NutritionDayContext;
  compact?: boolean;
  scoreOnly?: boolean;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const micros = estimateDailyMicros(meals, context.current);
  const health = scoreDailyNutrition({ ...context, micros });

  if (scoreOnly) {
    return (
      <div className={cn("flex shrink-0 flex-col items-center", className)}>
        <ScoreGauge
          score={health.score}
          label=""
          innerLabel={{
            before: platform.nutrition.healthScoreInnerBefore,
            after: platform.nutrition.healthScoreInnerAfter,
          }}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      <div
        className={cn(
          "flex items-center gap-3",
          compact
            ? "justify-between"
            : "rounded-xl border border-border/60 bg-secondary/20 px-3 py-3"
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {platform.nutrition.healthScore}
          </p>
          <p className="text-sm font-bold">
            {health.label}{" "}
            <span className="text-muted-foreground">· {health.score}/100</span>
          </p>
        </div>
        <ScoreGauge
          score={health.score}
          label=""
          innerLabel={{
            before: platform.nutrition.healthScoreInnerBefore,
            after: platform.nutrition.healthScoreInnerAfter,
          }}
          size="sm"
        />
      </div>

      <NutritionMacroRings
        current={context.current}
        targets={context.targets}
        micros={micros}
        variant={compact ? "compact" : "detail"}
        showMicros
        macroSectionTitle={platform.nutrition.macros}
        microSectionTitle={platform.nutrition.microNutrients}
      />
    </div>
  );
}
