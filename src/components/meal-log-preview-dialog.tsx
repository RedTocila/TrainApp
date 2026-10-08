"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Target, X } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { MealAnalysisSummary } from "@/components/meal-analysis-summary";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useCoachCopy, usePlatformCopy } from "@/components/locale-provider";
import type { MealFormData } from "@/lib/meal-utils";
import type { MacroTargets } from "@/lib/meal-score";
import { scoreMeal } from "@/lib/meal-score";
import { getCoachMealAdvice, getMealAdviceTier, getMealScoreTierStyles } from "@/lib/meal-coach-advice";
import { formatMealMacrosSummary } from "@/lib/meal-utils";
import { MealMacroDiagram } from "@/components/meal-macro-diagram";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MealLogPreviewDialog({
  open,
  meal,
  photoUrl,
  targets,
  goal,
  onClose,
  onDelete,
  isDeleting = false,
  variant = "new",
}: {
  open: boolean;
  meal: MealFormData | null;
  photoUrl?: string | null;
  targets: MacroTargets;
  goal?: string | null;
  onClose: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  variant?: "new" | "view";
}) {
  const coachCopy = useCoachCopy();
  const platform = usePlatformCopy();
  const [adviceKey, setAdviceKey] = useState(0);

  useEffect(() => {
    if (open && meal) setAdviceKey(Date.now());
  }, [open, meal]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const score = useMemo(() => {
    if (!meal) return null;
    try {
      return scoreMeal({ meal, targets, goal });
    } catch {
      return null;
    }
  }, [meal, targets, goal]);

  const coachAdvice = useMemo(() => {
    if (!meal || !score) return null;
    try {
      return getCoachMealAdvice({
        copy: coachCopy,
        score: score.score,
        meal,
        reasons: score.reasons,
        goal,
        variationKey: adviceKey,
      });
    } catch {
      return null;
    }
  }, [adviceKey, coachCopy, meal, score, goal]);

  const adviceTier = score ? getMealAdviceTier(score.score) : "ok";
  const tierStyles = getMealScoreTierStyles(adviceTier);

  if (!open || !meal) return null;

  if (variant === "view") {
    return (
      <AppOverlay
        open={open}
        onClose={onClose}
        fullscreen
        closeOnBackdrop={!isDeleting}
      >
        <AppOverlayPanel
          fullscreen
          showHandle={false}
          dismissible={!isDeleting}
          aria-label="Meal insights"
          className="bg-background"
        >
          <div className="absolute inset-x-0 top-0 z-30 flex justify-end bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/45 text-white hover:bg-black/60 hover:text-white"
              onClick={onClose}
              disabled={isDeleting}
              aria-label={platform.aria.close}
            >
              <X className="h-6 w-6" strokeWidth={2.25} />
            </Button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-0">
              <MealAnalysisSummary
                form={meal}
                confidence={null}
                imageUrl={photoUrl}
                onSave={onClose}
                saveLabel={platform.common.done}
                isSaving={isDeleting}
                onSecondary={onDelete}
                secondaryLabel={onDelete ? platform.aria.deleteMeal : undefined}
                secondaryDisabled={isDeleting}
              />
            </div>
          </div>
        </AppOverlayPanel>
      </AppOverlay>
    );
  }

  const summary = formatMealMacrosSummary(meal.macros);

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-lg" aria-label="Meal logged preview" className="max-h-[min(92%,42rem)]">
        <div className="shrink-0 space-y-2 px-5 pb-3.5 pt-1 sm:pt-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {variant === "new" ? "Meal logged" : "Meal insights"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black leading-tight">{meal.name}</h2>
              <Badge variant="secondary" className="capitalize">
                {meal.meal_type}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary ? (
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">{summary}</p>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full px-3.5"
                onClick={onClose}
                disabled={isDeleting}
              >
                <Check className="h-3.5 w-3.5" />
                {platform.common.done}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4" data-scroll-lock-scrollable>
          {photoUrl ? (
            <div className="relative mb-4 mx-auto aspect-[3/4] w-full max-w-sm shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={meal.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : null}

          <MealMacroDiagram macros={meal.macros} targets={targets} className="mb-4" />

          {score ? (
            <Card className={cn("border", tierStyles.card)}>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreGauge
                  score={score.score}
                  label={`${score.label} fit`}
                  icon={Target}
                  colorClass={tierStyles.gauge}
                  size="md"
                />
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Why this score</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {score.reasons.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", tierStyles.bullet)}
                        />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Meal logged successfully. Insights are unavailable for this entry right now.
              </CardContent>
            </Card>
          )}

          {coachAdvice && (
            <div
              className={cn(
                "mt-4 rounded-xl border p-4",
                tierStyles.coachCard
              )}
            >
              <div className="flex gap-3">
                <AiCoachAvatar size="sm" />
                <div className="min-w-0 space-y-1">
                  <p className={cn("text-sm font-bold", tierStyles.accent)}>
                    {coachCopy.mealInsights.coachName}
                  </p>
                  <p className={cn("text-sm leading-relaxed", tierStyles.quote)}>
                    &ldquo;{coachAdvice}&rdquo;
                  </p>
                </div>
              </div>
            </div>
          )}

          {meal.ingredients.length > 0 && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Ingredients</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {meal.ingredients.slice(0, 18).map((i, idx) => (
                    <span key={idx} className="rounded-lg bg-secondary/50 px-2 py-1 text-[11px]">
                      {i.name}
                      {i.amount ? ` · ${i.amount}` : ""}
                    </span>
                  ))}
                  {meal.ingredients.length > 18 && (
                    <span className="rounded-lg bg-secondary/30 px-2 py-1 text-[11px] text-muted-foreground">
                      +{meal.ingredients.length - 18} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </AppOverlayPanel>
      </AppOverlay>
  );
}

