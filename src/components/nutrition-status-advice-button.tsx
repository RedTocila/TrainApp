"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import {
  DayMacroStatusStrip,
  OverageInsightCards,
} from "@/components/overage-insight-card";
import { OverageInsightHeader } from "@/components/overage-insight-header";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";
import { analyzeDayMacroOverageAction } from "@/lib/actions/ai-macro-overage";
import { buildOverageLocalCopy } from "@/lib/macro-overage-copy";
import {
  buildLocalDayOverageInsights,
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import {
  getNutritionStatusAdvice,
  type DailyMicros,
  type NutritionDayContext,
  type NutritionDayStatus,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { formatUserError } from "@/lib/format-user-error";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  NutritionDayStatus,
  { button: string; title: string; dialog: string }
> = {
  good: {
    button:
      "border-emerald-400/55 bg-background/70 text-emerald-400 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-background/80 dark:bg-background/55 dark:hover:bg-background/70",
    title: "text-emerald-400",
    dialog: "border-emerald-500/30 bg-emerald-500/15",
  },
  bad: {
    button:
      "border-amber-400/55 bg-background/70 text-amber-400 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-background/80 dark:bg-background/55 dark:hover:bg-background/70",
    title: "text-amber-400",
    dialog: "border-amber-500/30 bg-amber-500/15",
  },
  missed: {
    button:
      "border-red-400/55 bg-background/70 text-red-400 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-background/80 dark:bg-background/55 dark:hover:bg-background/70",
    title: "text-red-400",
    dialog: "border-red-500/30 bg-red-500/15",
  },
  too_much: {
    button:
      "border-amber-400/55 bg-background/70 text-amber-400 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-background/80 dark:bg-background/55 dark:hover:bg-background/70",
    title: "text-amber-400",
    dialog: "border-amber-500/30 bg-amber-500/15",
  },
};

function nutrientShortName(
  platform: ReturnType<typeof usePlatformCopy>,
  nutrient: OverageNutrient
): string {
  return platform.nutrition.nutrientShort[nutrient];
}

export function NutritionStatusAdviceButton({
  status,
  context,
  meals = [],
  micros,
  className,
  variant = "chip",
  onClick,
}: {
  status: NutritionDayStatus;
  context: NutritionDayContext;
  meals?: DailyMealLog[];
  micros?: DailyMicros | null;
  className?: string;
  variant?: "chip" | "banner";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<MacroOverageInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const advice = getNutritionStatusAdvice(status, coachCopy, coachLabels, context);
  const styles = STATUS_STYLES[status];
  const showOverageInsights = status === "too_much";

  const dayChatPrompt = useMemo(() => {
    if (showOverageInsights && insights.length > 0) {
      const summary = insights
        .map((insight) => {
          const nutrient = nutrientShortName(platform, insight.nutrient);
          const amount =
            insight.amountFromMeal > 0
              ? ` ~${insight.amountFromMeal}${nutrientUnit(insight.nutrient)}`
              : "";
          return `${nutrient}: ${insight.culpritMealName}${amount}`;
        })
        .join("; ");
      return platform.nutrition.dayOverageAskAlex(summary);
    }
    if (status !== "good") {
      return platform.nutrition.statusAskAlex({
        title: advice.title,
        message: advice.message,
      });
    }
    return undefined;
  }, [
    advice.message,
    advice.title,
    insights,
    platform,
    showOverageInsights,
    status,
  ]);

  useEffect(() => {
    if (!open || !showOverageInsights) return;

    const local = buildLocalDayOverageInsights({
      meals,
      current: context.current,
      targets: context.targets,
      micros,
      tips: buildOverageLocalCopy(platform.nutrition),
    });
    setInsights(local);
    setError(null);
    setRefining(true);

    let cancelled = false;
    void analyzeDayMacroOverageAction({
      dateKey: context.dateKey,
      current: context.current,
      targets: context.targets,
      micros,
    })
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          if (local.length === 0) {
            setError(formatUserError(result.error));
          }
          return;
        }
        if (result.insights.length > 0) {
          setInsights(result.insights);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (local.length === 0) {
          setError(
            formatUserError(
              err instanceof Error ? err.message : "Failed to analyze meals"
            )
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRefining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    showOverageInsights,
    meals,
    context.current,
    context.targets,
    context.dateKey,
    micros,
    platform.nutrition,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          onClick?.(event);
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          variant === "banner"
            ? cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors active:scale-[0.99]",
                styles.dialog,
                "hover:brightness-110"
              )
            : cn(
                "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold uppercase leading-none tracking-wide transition-colors",
                styles.button
              ),
          className
        )}
      >
        {variant === "banner" ? (
          <>
            <AiCoachAvatar size="sm" className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-black", styles.title)}>{advice.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {advice.message}
              </p>
              {advice.detail ? (
                <p className="mt-1.5 text-xs text-muted-foreground/80">{advice.detail}</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {status !== "good" ? (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : null}
            {advice.title}
          </>
        )}
      </button>

      <AppOverlay open={open} onClose={() => setOpen(false)}>
        <AppOverlayPanel maxWidth="max-w-md" className="max-h-[min(92%,36rem)]">
          <OverageInsightHeader
            title={advice.title}
            subtitle={coachCopy.mealInsights.coachName}
            titleClassName={styles.title}
            howToFixLabel={platform.nutrition.howToFix}
            chatPrompt={dayChatPrompt}
            showHowToFix={status !== "good" && Boolean(dayChatPrompt)}
            closeAriaLabel={platform.aria.close}
            onClose={() => setOpen(false)}
          />

          <div
            data-scroll-lock-scrollable
            className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
          >
            {showOverageInsights ? (
              <>
                <DayMacroStatusStrip
                  current={context.current}
                  targets={context.targets}
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {platform.nutrition.problemMeal}
                    </p>
                    {refining ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                    ) : null}
                  </div>
                  {error ? (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm text-red-300">
                      {error}
                    </p>
                  ) : (
                    <OverageInsightCards insights={insights} />
                  )}
                </div>
              </>
            ) : (
              <div className={cn("rounded-xl border px-3 py-3", styles.dialog)}>
                <p className="text-sm leading-snug">{advice.message}</p>
                {advice.detail ? (
                  <p className="mt-2 text-xs text-muted-foreground">{advice.detail}</p>
                ) : null}
              </div>
            )}
          </div>
        </AppOverlayPanel>
      </AppOverlay>
    </>
  );
}
