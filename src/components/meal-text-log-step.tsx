"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { analyzeMealTextAction } from "@/lib/actions/ai-meal";
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
      const response = await analyzeMealTextAction(input.trim());
      if ("error" in response) {
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Type what you ate in plain language — AI will extract foods and estimate macros.
      </p>
      <Textarea
        placeholder={'e.g. "2 eggs and a banana" or "Chicken breast with rice and salad"'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        disabled={isPending || phase === "analyzing"}
      />
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {["2 eggs and toast", "Protein shake and apple", "Salmon with potatoes"].map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full border border-border px-2.5 py-1 hover:bg-secondary"
            onClick={() => setInput(ex)}
          >
            {ex}
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!input.trim() || isPending || phase === "analyzing"}
        onClick={handleAnalyze}
      >
        {isPending || phase === "analyzing" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Parsing meal…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze with AI
          </>
        )}
      </Button>
    </div>
  );
}
