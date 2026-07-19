"use client";

import { useState, type MouseEvent } from "react";
import { Loader2, X } from "lucide-react";
import { DialogPortal } from "@/components/dialog-portal";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { usePlatformCopy } from "@/components/locale-provider";
import { analyzeMacroOverageAction } from "@/lib/actions/ai-macro-overage";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import {
  fallbackMacroOverageInsight,
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import type { MealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";
import { formatUserError } from "@/lib/format-user-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MacroOverageInsightButton({
  nutrient,
  dateKey,
  current,
  targets,
  meals = [],
  label,
  className,
}: {
  nutrient: OverageNutrient;
  dateKey: string;
  current: MealMacros;
  targets: MealMacros;
  meals?: DailyMealLog[];
  label?: string;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<MacroOverageInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);

  useLockBodyScroll(open);

  const openDialog = (event?: MouseEvent) => {
    event?.stopPropagation();
    setOpen(true);
    setError(null);

    // Instant local answer — never leave the dialog stuck on a spinner.
    const local = fallbackMacroOverageInsight(meals, nutrient, targets);
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
          // Keep local insight; only surface the error if local had nothing useful.
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
            className="relative z-10 flex max-h-[min(85vh,30rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
                <div className="flex items-start justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <AiCoachAvatar size="sm" className="h-10 w-10 shrink-0" />
                    <div>
                      <h2 className="text-lg font-black text-red-400">
                        {platform.nutrition.whatWentWrongTitle}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {platform.nutrition.whatWentWrongSubtitle}
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
                  {error && !insight ? (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm text-red-300">
                      {error}
                    </p>
                  ) : insight ? (
                    <>
                      <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                            {platform.nutrition.problemMeal}
                          </p>
                          {refining ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-300" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-base font-black">
                          {insight.culpritMealName}
                        </p>
                        {insight.amountFromMeal > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            ~{insight.amountFromMeal}
                            {nutrientUnit(insight.nutrient)}{" "}
                            {platform.nutrition.fromThisMeal}
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
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed">
                          {insight.explanation}
                        </p>
                        <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {platform.nutrition.nextTimeLabel}:{" "}
                          </span>
                          {insight.avoidNextTime}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-red-400" />
                      <p>{platform.nutrition.analyzingMeals}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-border px-5 py-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {platform.common.done}
                  </Button>
                </div>
              </div>
            </div>
      </DialogPortal>
    </>
  );
}
