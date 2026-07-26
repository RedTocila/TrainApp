"use client";

import { useState } from "react";
import {
  Beef,
  Check,
  Coffee,
  Droplets,
  Flame,
  Loader2,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMealTypeOptions } from "@/lib/locale-labels";
import { formatMealMacrosSummary, type MealFormData, type MealMacros } from "@/lib/meal-utils";
import type { MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEAL_TYPE_META: Record<MealType, { icon: typeof Coffee; className: string }> = {
  breakfast: { icon: Coffee, className: "text-amber-400 bg-amber-500/15" },
  lunch: { icon: Sun, className: "text-orange-400 bg-orange-500/15" },
  dinner: { icon: Moon, className: "text-indigo-400 bg-indigo-500/15" },
  snack: { icon: UtensilsCrossed, className: "text-emerald-400 bg-emerald-500/15" },
};

function macroRows(platform: ReturnType<typeof usePlatformCopy>) {
  return [
    {
      key: "protein" as const,
      label: platform.ai.protein,
      icon: Beef,
      text: "text-rose-400",
      bar: "bg-rose-500",
      track: "bg-rose-500/15",
    },
    {
      key: "carbs" as const,
      label: platform.ai.carbs,
      icon: Wheat,
      text: "text-amber-400",
      bar: "bg-amber-500",
      track: "bg-amber-500/15",
    },
    {
      key: "fat" as const,
      label: platform.ai.fat,
      icon: Droplets,
      text: "text-sky-400",
      bar: "bg-sky-500",
      track: "bg-sky-500/15",
    },
  ];
}

function macroCalories(macros: MealMacros) {
  return {
    protein: macros.protein * 4,
    carbs: macros.carbs * 4,
    fat: macros.fat * 9,
  };
}

function MacroDonut({ macros }: { macros: MealMacros }) {
  const split = macroCalories(macros);
  const total = split.protein + split.carbs + split.fat || 1;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: split.protein, color: "#f43f5e" },
    { value: split.carbs, color: "#f59e0b" },
    { value: split.fat, color: "#0ea5e9" },
  ];

  let offset = 0;

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-border/60"
        />
        {segments.map((segment, index) => {
          const length = (segment.value / total) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;

          return (
            <circle
              key={index}
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <Flame className="mb-0.5 h-4 w-4 text-orange-400" />
        <span className="text-xl font-black leading-none">{macros.calories}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          kcal
        </span>
      </div>
    </div>
  );
}

function MacroBars({
  macros,
  rows,
}: {
  macros: MealMacros;
  rows: ReturnType<typeof macroRows>;
}) {
  const max = Math.max(macros.protein, macros.carbs, macros.fat, 1);

  return (
    <div className="min-w-0 flex-1 space-y-2.5">
      {rows.map((row) => {
        const Icon = row.icon;
        const value = macros[row.key];
        const width = Math.max(8, (value / max) * 100);

        return (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className={cn("inline-flex items-center gap-1.5 font-medium", row.text)}>
                <Icon className="h-3.5 w-3.5" />
                {row.label}
              </span>
              <span className="font-semibold text-foreground">
                {value}
                <span className="text-muted-foreground">g</span>
              </span>
            </div>
            <div className={cn("h-2 overflow-hidden rounded-full", row.track)}>
              <div className={cn("h-full rounded-full transition-all", row.bar)} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MealAnalysisSummary({
  form,
  confidence,
  imageUrl,
  onRefineWithSpecification,
  isRefining = false,
  onSave,
  isSaving = false,
  saveLabel,
}: {
  form: MealFormData;
  confidence: number | null;
  imageUrl?: string | null;
  onRefineWithSpecification?: (specification: string) => void;
  isRefining?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const [isEditingWithAi, setIsEditingWithAi] = useState(false);
  const [specification, setSpecification] = useState("");
  const mealTypeLabels = Object.fromEntries(
    getMealTypeOptions(locale)
      .filter((option) => option.value !== "all")
      .map((option) => [option.value, option.label])
  ) as Record<MealType, string>;
  const rows = macroRows(platform);
  const mealMeta = MEAL_TYPE_META[form.meal_type];
  const MealIcon = mealMeta.icon;
  const ingredients = form.ingredients.filter((item) => item.name.trim());
  const summary = formatMealMacrosSummary(form.macros);

  const handleRefine = () => {
    const trimmed = specification.trim();
    if (trimmed.length < 3) return;
    onRefineWithSpecification?.(trimmed);
  };

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
          <img
            src={imageUrl}
            alt={platform.mealLog.mealPreview}
            className="mx-auto h-auto max-h-[min(60vh,28rem)] w-full object-contain"
          />
        </div>
      )}

      {summary ? (
        <p className="text-xs text-muted-foreground">{summary}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card transition-colors">
        <div className="border-b border-border/70 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI analysis complete
                {confidence != null && <ConfidenceBadge confidence={confidence} />}
              </p>

              <h3 className="mt-1.5 text-lg font-bold leading-tight">{form.name}</h3>

              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  mealMeta.className
                )}
              >
                <MealIcon className="h-3.5 w-3.5" />
                {mealTypeLabels[form.meal_type]}
              </span>
            </div>

            {onRefineWithSpecification && (
              <Button
                type="button"
                variant={isEditingWithAi ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setIsEditingWithAi((value) => !value)}
                disabled={isRefining || isSaving}
                aria-label={platform.common.edit}
                aria-pressed={isEditingWithAi}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          {form.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{form.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 p-4">
          <MacroDonut macros={form.macros} />
          <MacroBars macros={form.macros} rows={rows} />
        </div>

        {ingredients.length > 0 && (
          <div className="border-t border-border/70 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ingredients
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ingredients.map((ingredient, index) => (
                <span
                  key={`${ingredient.name}-${index}`}
                  className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-foreground"
                >
                  {ingredient.name}
                  {ingredient.amount ? (
                    <span className="text-muted-foreground"> · {ingredient.amount}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEditingWithAi && onRefineWithSpecification && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">{platform.mealLog.specifyHint}</p>
          <Textarea
            value={specification}
            onChange={(event) => setSpecification(event.target.value)}
            rows={3}
            placeholder={platform.mealLog.specifyPlaceholder}
            className="mt-3 resize-none text-sm"
            disabled={isRefining}
          />
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={isRefining || specification.trim().length < 3}
            onClick={handleRefine}
          >
            {isRefining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {platform.mealLog.refiningMeal}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {platform.mealLog.refineWithAi}
              </>
            )}
          </Button>
        </div>
      )}

      {onSave ? (
        <Button
          type="button"
          className="w-full"
          disabled={isSaving || isRefining}
          onClick={onSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {platform.common.saving}
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {saveLabel ?? platform.mealLog.logMeal}
            </>
          )}
        </Button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {isEditingWithAi ? (
            <>
              Add details above, then tap{" "}
              <span className="font-medium text-foreground">{platform.mealLog.refineWithAi}</span>.
            </>
          ) : (
            <>Review the analysis, then log when it looks right.</>
          )}
        </p>
      )}
    </div>
  );
}
