"use client";

import {
  Beef,
  Coffee,
  Droplets,
  Flame,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getMealTypeOptions } from "@/lib/locale-labels";
import type { MealType } from "@/lib/types";
import type { MealFormData, MealIngredient, MealMacros } from "@/lib/meal-utils";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MEAL_TYPE_META: Record<
  MealType,
  { icon: typeof Coffee; className: string }
> = {
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
      text: "text-sky-400",
      bar: "bg-sky-500",
      track: "bg-sky-500/15",
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
      text: "text-blue-400",
      bar: "bg-blue-500",
      track: "bg-blue-500/15",
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

function MacroDonut({
  macros,
  isAdjusting,
  onCaloriesChange,
}: {
  macros: MealMacros;
  isAdjusting: boolean;
  onCaloriesChange: (value: number) => void;
}) {
  const split = macroCalories(macros);
  const total = split.protein + split.carbs + split.fat || 1;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: split.protein, color: "#0ea5e9" },
    { value: split.carbs, color: "#f59e0b" },
    { value: split.fat, color: "#3b82f6" },
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
        <Flame className="mb-0.5 h-4 w-4 text-primary" />
        {isAdjusting ? (
          <Input
            type="number"
            min={0}
            value={macros.calories}
            onChange={(e) => onCaloriesChange(parseInt(e.target.value, 10) || 0)}
            className="h-8 w-16 border-primary/30 bg-background/90 px-1 text-center text-sm font-black"
          />
        ) : (
          <span className="text-xl font-black leading-none">{macros.calories}</span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          kcal
        </span>
      </div>
    </div>
  );
}

function MacroBars({
  macros,
  isAdjusting,
  onMacroChange,
  rows,
}: {
  macros: MealMacros;
  isAdjusting: boolean;
  onMacroChange: (key: keyof MealMacros, value: number) => void;
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
              {isAdjusting ? (
                <Input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) =>
                    onMacroChange(row.key, parseInt(e.target.value, 10) || 0)
                  }
                  className="h-7 w-16 px-2 text-right text-xs font-semibold"
                />
              ) : (
                <span className="font-semibold text-foreground">
                  {value}
                  <span className="text-muted-foreground">g</span>
                </span>
              )}
            </div>
            <div className={cn("h-2 overflow-hidden rounded-full", row.track)}>
              <div
                className={cn("h-full rounded-full transition-all", row.bar)}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MealAnalysisSummary({
  form,
  onFormChange,
  confidence,
  imageUrl,
  isAdjusting,
  onToggleAdjust,
  onRetake,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  confidence: number | null;
  imageUrl?: string | null;
  isAdjusting: boolean;
  onToggleAdjust: () => void;
  onRetake?: () => void;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const mealTypeLabels = Object.fromEntries(
    getMealTypeOptions(locale)
      .filter((option) => option.value !== "all")
      .map((option) => [option.value, option.label])
  ) as Record<MealType, string>;
  const rows = macroRows(platform);
  const mealMeta = MEAL_TYPE_META[form.meal_type];
  const MealIcon = mealMeta.icon;
  const ingredients = form.ingredients.filter((item) => item.name.trim());

  const updateMacros = (key: keyof MealMacros, value: number) => {
    onFormChange({ ...form, macros: { ...form.macros, [key]: value } });
  };

  const updateIngredient = (index: number, field: keyof MealIngredient, value: string) => {
    const next = [...form.ingredients];
    next[index] = { ...next[index], [field]: value };
    onFormChange({ ...form, ingredients: next });
  };

  const removeIngredient = (index: number) => {
    onFormChange({
      ...form,
      ingredients: form.ingredients.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
          <img
            src={imageUrl}
            alt={platform.mealLog.mealPreview}
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card transition-colors",
          isAdjusting ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
        )}
      >
        <div className="border-b border-border/70 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI analysis complete
                {confidence != null && <ConfidenceBadge confidence={confidence} />}
              </p>

              {isAdjusting ? (
                <Input
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                  className="mt-2 h-10 text-base font-bold"
                  placeholder={platform.mealLog.mealName}
                />
              ) : (
                <h3 className="mt-1.5 text-lg font-bold leading-tight">{form.name}</h3>
              )}

              {isAdjusting ? (
                <select
                  value={form.meal_type}
                  onChange={(e) =>
                    onFormChange({ ...form, meal_type: e.target.value as MealType })
                  }
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {(Object.keys(mealTypeLabels) as MealType[]).map((mealType) => (
                    <option key={mealType} value={mealType}>
                      {mealTypeLabels[mealType]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    mealMeta.className
                  )}
                >
                  <MealIcon className="h-3.5 w-3.5" />
                  {mealTypeLabels[form.meal_type]}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant={isAdjusting ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={onToggleAdjust}
                aria-label={
                  isAdjusting ? platform.mealLog.doneAdjusting : platform.mealLog.adjustDetails
                }
                aria-pressed={isAdjusting}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {onRetake && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={onRetake}
                  aria-label={platform.mealLog.retakePhoto}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {isAdjusting ? (
            <Textarea
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={2}
              placeholder={platform.mealLog.descriptionNotes}
              className="mt-3 resize-none text-sm"
            />
          ) : (
            form.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {form.description}
              </p>
            )
          )}
        </div>

        <div className="flex items-center gap-4 p-4">
          <MacroDonut
            macros={form.macros}
            isAdjusting={isAdjusting}
            onCaloriesChange={(calories) => updateMacros("calories", calories)}
          />
          <MacroBars
            macros={form.macros}
            isAdjusting={isAdjusting}
            onMacroChange={updateMacros}
            rows={rows}
          />
        </div>

        {(ingredients.length > 0 || isAdjusting) && (
          <div className="border-t border-border/70 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ingredients
            </p>

            {isAdjusting ? (
              <div className="space-y-2">
                {form.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Ingredient"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, "name", e.target.value)}
                      className="h-9 flex-1 text-sm"
                    />
                    <Input
                      placeholder="Amount"
                      value={ingredient.amount ?? ""}
                      onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                      className="h-9 w-24 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeIngredient(index)}
                      aria-label={platform.mealLog.removeIngredient}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFormChange({
                      ...form,
                      ingredients: [...form.ingredients, { name: "", amount: "" }],
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add ingredient
                </Button>
              </div>
            ) : (
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
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isAdjusting ? (
          <>
            Tap the pencil again when done — then{" "}
            <span className="font-medium text-foreground">Confirm &amp; log meal</span>.
          </>
        ) : (
          <>
            Looks good? Tap <span className="font-medium text-foreground">Confirm &amp; log meal</span>{" "}
            below — or the pencil to tweak on the spot.
          </>
        )}
      </p>
    </div>
  );
}
