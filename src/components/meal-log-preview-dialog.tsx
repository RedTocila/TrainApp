"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Target, X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useCoachCopy } from "@/components/locale-provider";
import type { MealFormData } from "@/lib/meal-utils";
import type { MacroTargets } from "@/lib/meal-score";
import { scoreMeal } from "@/lib/meal-score";
import { getCoachMealAdvice, getMealAdviceTier, getMealScoreTierStyles } from "@/lib/meal-coach-advice";
import { formatMealMacrosSummary } from "@/lib/meal-utils";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MealLogPreviewDialog({
  open,
  meal,
  targets,
  goal,
  onClose,
  variant = "new",
}: {
  open: boolean;
  meal: MealFormData | null;
  targets: MacroTargets;
  goal?: string | null;
  onClose: () => void;
  variant?: "new" | "view";
}) {
  const coachCopy = useCoachCopy();
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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
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

  const summary = formatMealMacrosSummary(meal.macros);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meal logged preview"
        className="relative z-10 flex max-h-[min(90vh,42rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {variant === "new" ? "Meal logged" : "Meal insights"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">{meal.name}</h2>
              <Badge variant="secondary" className="capitalize">
                {meal.meal_type}
              </Badge>
            </div>
            {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
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

          {meal.ingredients?.length > 0 && (
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

        <div className="border-t border-border px-5 py-3">
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

