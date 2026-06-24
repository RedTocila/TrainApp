"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, RefreshCw, Salad, Sparkles } from "lucide-react";
import {
  applyAiNutritionPlanAction,
  generateAiNutritionPlanAction,
} from "@/lib/actions/ai-plan-builder";
import type { AiGeneratedNutritionPlan } from "@/lib/ai/plan-builder-types";
import { slotLabel } from "@/lib/meal-slots";
import { AiPlanProfileSummary } from "@/components/ai-plan-profile-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types";

function MacroPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

export function AiNutritionPlanBuilder({
  profile,
  intakeComplete,
}: {
  profile: Profile;
  intakeComplete: boolean;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState("");
  const [plan, setPlan] = useState<AiGeneratedNutritionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await generateAiNutritionPlanAction(preferences);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPlan(result.plan);
    });
  };

  const handleApply = () => {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const result = await applyAiNutritionPlanAction(plan);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setApplied(true);
      router.push(`/dashboard/nutrition/${result.planId}/edit`);
    });
  };

  const t = plan?.daily_targets;

  return (
    <div className="space-y-6">
      <AiPlanProfileSummary profile={profile} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Salad className="h-4 w-4 text-primary" />
            Build nutrition plan
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI calculates your daily macros and builds a full day menu from your health
            profile. Review meals and targets before applying.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!intakeComplete && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              Add age, gender, weight, and goal for accurate macro targets.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="nutrition-preferences">Extra preferences (optional)</Label>
            <Textarea
              id="nutrition-preferences"
              rows={3}
              placeholder="e.g. Vegetarian, no dairy, prefer 4 meals, budget-friendly…"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleGenerate} disabled={isPending}>
            {isPending && !plan ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building your plan…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate nutrition plan
              </>
            )}
          </Button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {plan && t && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{plan.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <Badge variant="secondary">{plan.meals.length} meals</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Daily targets
              </p>
              <div className="grid grid-cols-4 gap-2">
                <MacroPill label="Calories" value={t.calories} />
                <MacroPill label="Protein" value={t.protein} />
                <MacroPill label="Carbs" value={t.carbs} />
                <MacroPill label="Fat" value={t.fat} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Day menu
              </p>
              {plan.meals.map((meal) => (
                <div
                  key={`${meal.slot}-${meal.name}`}
                  className="rounded-xl border border-border bg-secondary/20 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-primary">{slotLabel(meal.slot)}</p>
                      <p className="font-semibold">{meal.name}</p>
                      {meal.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{meal.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {meal.calories} cal · {meal.protein}g P · {meal.carbs}g C · {meal.fat}g F
                    </p>
                  </div>
                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {meal.ingredients
                        .map((i) => (i.amount ? `${i.name} (${i.amount})` : i.name))
                        .join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {plan.coach_notes.length > 0 && (
              <div className="rounded-lg bg-primary/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Coach notes
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {plan.coach_notes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
              <Button onClick={handleApply} disabled={isPending || applied}>
                {applied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Applied
                  </>
                ) : isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Apply to my nutrition"
                )}
              </Button>
              {applied && (
                <Link
                  href="/dashboard/nutrition"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Open nutrition
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
