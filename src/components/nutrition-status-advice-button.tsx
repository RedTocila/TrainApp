"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Loader2, X } from "lucide-react";
import { DialogPortal } from "@/components/dialog-portal";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";
import { analyzeDayMacroOverageAction } from "@/lib/actions/ai-macro-overage";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import {
  buildLocalDayOverageInsights,
  nutrientLabel,
  nutrientUnit,
  type MacroOverageInsight,
} from "@/lib/macro-overage-local";
import {
  getNutritionStatusAdvice,
  type DailyMicros,
  type NutritionDayContext,
  type NutritionDayStatus,
} from "@/lib/nutrition-day-utils";
import type { DailyMealLog } from "@/lib/types";
import { formatUserError } from "@/lib/format-user-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  NutritionDayStatus,
  { button: string; title: string; dialog: string }
> = {
  good: {
    button: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    title: "text-emerald-400",
    dialog: "border-emerald-500/30 bg-emerald-500/5",
  },
  bad: {
    button: "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    title: "text-amber-400",
    dialog: "border-amber-500/30 bg-amber-500/5",
  },
  missed: {
    button: "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    title: "text-red-400",
    dialog: "border-red-500/30 bg-red-500/5",
  },
  too_much: {
    button: "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
    title: "text-orange-400",
    dialog: "border-orange-500/30 bg-orange-500/5",
  },
};

function OverageInsightCards({
  insights,
}: {
  insights: MacroOverageInsight[];
}) {
  const platform = usePlatformCopy();
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      {insights.map((insight) => (
        <div
          key={insight.nutrient}
          className="rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-300">
            {platform.nutrition.extraNutrient(nutrientLabel(insight.nutrient))}
          </p>
          <p className="mt-1 text-sm font-black">{insight.culpritMealName}</p>
          {insight.amountFromMeal > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              ~{insight.amountFromMeal}
              {nutrientUnit(insight.nutrient)} {platform.nutrition.fromThisMeal}
            </p>
          ) : null}
          {insight.problemFoods.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {platform.nutrition.problemFoods}:{" "}
              </span>
              {insight.problemFoods.join(", ")}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed">{insight.explanation}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {platform.nutrition.nextTimeLabel}:{" "}
            </span>
            {insight.avoidNextTime}
          </p>
        </div>
      ))}
    </div>
  );
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

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open || !showOverageInsights) return;

    const local = buildLocalDayOverageInsights({
      meals,
      current: context.current,
      targets: context.targets,
      micros,
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
                "max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase leading-snug tracking-wide transition-colors",
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
          advice.title
        )}
      </button>

      <DialogPortal open={open}>
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={platform.aria.close}
            className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[min(85vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
                <div className="flex items-start justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <AiCoachAvatar size="sm" className="h-10 w-10 shrink-0" />
                    <div>
                      <h2 className={cn("text-lg font-black", styles.title)}>
                        {advice.title}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {coachCopy.mealInsights.coachName}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(false)}
                    aria-label={platform.aria.close}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div
                  data-scroll-lock-scrollable
                  className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
                >
                  <div className={cn("rounded-xl border px-3 py-3", styles.dialog)}>
                    <p className="text-sm leading-relaxed">{advice.message}</p>
                    {advice.detail ? (
                      <p className="mt-2 text-xs text-muted-foreground">{advice.detail}</p>
                    ) : null}
                  </div>

                  {showOverageInsights ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {platform.nutrition.whatWentWrongTitle}
                        </p>
                        {refining ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-300" />
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
                  ) : null}
                </div>

                <div className="space-y-2 border-t border-border px-5 py-3">
                  <OpenAiCoachChatButton
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {platform.ai.askAlex}
                  </OpenAiCoachChatButton>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {coachLabels.illDoBetter}
                  </Button>
                </div>
              </div>
            </div>
      </DialogPortal>
    </>
  );
}
