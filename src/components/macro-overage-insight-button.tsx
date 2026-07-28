"use client";

import { useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { OverageInsightCard } from "@/components/overage-insight-card";
import { OverageInsightHeader } from "@/components/overage-insight-header";
import { usePlatformCopy } from "@/components/locale-provider";
import { analyzeMacroOverageAction } from "@/lib/actions/ai-macro-overage";
import { buildOverageLocalCopy } from "@/lib/macro-overage-copy";
import {
  fallbackMacroOverageInsight,
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import type { MealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";
import { formatUserError } from "@/lib/format-user-error";
import { cn } from "@/lib/utils";

export type OverageInsightSeverity = "warn" | "alert";

function nutrientShortName(
  platform: ReturnType<typeof usePlatformCopy>,
  nutrient: OverageNutrient
): string {
  return platform.nutrition.nutrientShort[nutrient];
}

function buildOverageChatPrompt(
  platform: ReturnType<typeof usePlatformCopy>,
  insight: MacroOverageInsight
): string {
  const nutrient = nutrientShortName(platform, insight.nutrient);
  const amountLine =
    insight.amountFromMeal > 0
      ? `~${insight.amountFromMeal}${nutrientUnit(insight.nutrient)}`
      : undefined;
  return platform.nutrition.overageAskAlex({
    nutrient,
    meal: insight.culpritMealName,
    amountLine,
  });
}

export function MacroOverageInsightButton({
  nutrient,
  dateKey,
  current,
  targets,
  meals = [],
  label,
  severity = "alert",
  className,
}: {
  nutrient: OverageNutrient;
  dateKey: string;
  current: MealMacros;
  targets: MealMacros;
  meals?: DailyMealLog[];
  label?: string;
  /** warn = over but inside tolerance; alert = past tolerance */
  severity?: OverageInsightSeverity;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<MacroOverageInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);

  const openDialog = (event?: MouseEvent) => {
    event?.stopPropagation();
    setOpen(true);
    setError(null);

    const local = fallbackMacroOverageInsight(
      meals,
      nutrient,
      targets,
      buildOverageLocalCopy(platform.nutrition)
    );
    setInsight(local);

    setRefining(true);
    void analyzeMacroOverageAction({
      dateKey,
      nutrient,
      current,
      targets,
    })
      .then((result) => {
        if ("error" in result) {
          if (!local.culpritMealId && local.amountFromMeal === 0) {
            setError(formatUserError(result.error));
          }
          return;
        }
        setInsight(result.insight);
      })
      .catch((err) => {
        if (!local.culpritMealId && local.amountFromMeal === 0) {
          setError(
            formatUserError(
              err instanceof Error ? err.message : "Failed to analyze meals"
            )
          );
        }
      })
      .finally(() => {
        setRefining(false);
      });
  };

  const ariaLabel = label ?? platform.nutrition.seeWhatWentWrong;
  const isWarn = severity === "warn";
  const chatPrompt = insight ? buildOverageChatPrompt(platform, insight) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          "border border-red-500/50 bg-red-500/15 text-sm font-black leading-none text-red-400",
          "transition-colors hover:bg-red-500/25 active:scale-[0.96]",
          className
        )}
      >
        !
      </button>

      <AppOverlay open={open} onClose={() => setOpen(false)}>
        <AppOverlayPanel maxWidth="max-w-md" className="max-h-[min(92%,28rem)]">
          <OverageInsightHeader
            title={platform.nutrition.whatWentWrongTitle}
            subtitle={platform.nutrition.whatWentWrongSubtitle}
            titleClassName={isWarn ? "text-amber-400" : "text-red-400"}
            howToFixLabel={platform.nutrition.howToFix}
            chatPrompt={chatPrompt}
            showHowToFix={Boolean(insight && chatPrompt)}
            closeAriaLabel={platform.aria.close}
            onClose={() => setOpen(false)}
          />

          <div
            data-scroll-lock-scrollable
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4"
          >
            {error && !insight ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : insight ? (
              <OverageInsightCard insight={insight} refining={refining} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                <Loader2
                  className={cn(
                    "h-6 w-6 animate-spin",
                    isWarn ? "text-amber-400" : "text-red-400"
                  )}
                />
                <p>{platform.nutrition.analyzingMeals}</p>
              </div>
            )}
          </div>
        </AppOverlayPanel>
      </AppOverlay>
    </>
  );
}
