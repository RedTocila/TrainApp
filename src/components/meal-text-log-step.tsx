"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { analyzeMealTextAction } from "@/lib/actions/ai-meal";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import {
  formatMealMacrosSummary,
  type MealFormData,
} from "@/lib/meal-utils";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/confidence-badge";

type TextPhase = "input" | "analyzing" | "review";

export function MealTextLogStep({
  form,
  onFormChange,
  onError,
  onReadyChange,
  confidence,
  onConfidenceChange,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  onError: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
  confidence: number | null;
  onConfidenceChange: (value: number | null) => void;
}) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<TextPhase>("input");
  const [isPending, startTransition] = useTransition();

  const setPhaseWithReady = (next: TextPhase) => {
    setPhase(next);
    onReadyChange?.(next === "review");
  };

  const handleAnalyze = () => {
    if (!input.trim()) {
      onError("Describe what you ate");
      return;
    }
    onError(null);
    setPhaseWithReady("analyzing");

    startTransition(async () => {
      const response = await runServerAction(() =>
        analyzeMealTextAction(input.trim())
      );
      if (isActionError(response)) {
        onError(response.error);
        setPhaseWithReady("input");
        return;
      }
      onFormChange(response.form);
      onConfidenceChange(response.result.confidence);
      setPhaseWithReady("review");
    });
  };

  const handleReset = () => {
    setInput("");
    setPhaseWithReady("input");
    onConfidenceChange(null);
    onError(null);
  };

  if (phase === "review") {
    const summary = formatMealMacrosSummary(form.macros);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-green-400">
            <Sparkles className="h-4 w-4" />
            AI parsed your meal
            {confidence != null && <ConfidenceBadge confidence={confidence} />}
          </p>
          <p className="mt-1 text-sm font-medium">{form.name}</p>
          {summary && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
        </div>
        <MealDetailsFields
          mealType={form.meal_type}
          onMealTypeChange={(meal_type) => onFormChange({ ...form, meal_type })}
          name={form.name}
          onNameChange={(name) => onFormChange({ ...form, name })}
          description={form.description}
          onDescriptionChange={(description) => onFormChange({ ...form, description })}
          macros={form.macros}
          onMacrosChange={(macros) => onFormChange({ ...form, macros })}
          ingredients={form.ingredients}
          onIngredientsChange={(ingredients) => onFormChange({ ...form, ingredients })}
        />
        <p className="text-xs text-muted-foreground">
          Edit anything, then tap <span className="font-medium text-foreground">Confirm &amp; log meal</span>.
        </p>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Try different description
        </Button>
      </div>
    );
  }

  const analyzing = isPending || phase === "analyzing";
  const canAnalyze = Boolean(input.trim()) && !analyzing;

  return (
    <div className="relative">
      <Textarea
        placeholder='e.g. "2 eggs and a banana" or "Chicken breast with rice and salad"'
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        disabled={analyzing}
        className="min-h-0 resize-none rounded-2xl pb-12 pr-12"
      />
      <Button
        type="button"
        size="icon"
        className="absolute bottom-2 right-2 h-10 w-10 rounded-full shadow-md shadow-primary/25"
        disabled={!canAnalyze}
        onClick={handleAnalyze}
        aria-label="Analyze with AI"
      >
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
