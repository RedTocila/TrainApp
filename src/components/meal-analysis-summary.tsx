"use client";

import { useState } from "react";
import {
  Check,
  Coffee,
  Loader2,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMealTypeOptions } from "@/lib/locale-labels";
import { type MealFormData, type MealMacros } from "@/lib/meal-utils";
import type { MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEAL_TYPE_META: Record<MealType, { icon: typeof Coffee }> = {
  breakfast: { icon: Coffee },
  lunch: { icon: Sun },
  dinner: { icon: Moon },
  snack: { icon: UtensilsCrossed },
};

function MacroMiniRing({
  label,
  value,
  ringClass,
}: {
  label: string;
  value: number;
  ringClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-[3px] bg-secondary text-sm font-black tabular-nums text-foreground",
          ringClass
        )}
      >
        {Math.round(value)}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function MealAnalysisSummary({
  form,
  onFormChange,
  confidence,
  imageUrl,
  onRefineWithSpecification,
  isRefining = false,
  onSave,
  isSaving = false,
  saveLabel,
  onRetake,
  retakeDisabled = false,
  onSecondary,
  secondaryLabel,
  secondaryDisabled = false,
}: {
  form: MealFormData;
  onFormChange?: (form: MealFormData) => void;
  confidence: number | null;
  imageUrl?: string | null;
  onRefineWithSpecification?: (specification: string) => void;
  isRefining?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  onRetake?: () => void;
  retakeDisabled?: boolean;
  onSecondary?: () => void;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [specification, setSpecification] = useState("");
  const canEdit = Boolean(onFormChange || onRefineWithSpecification);
  const mealTypeLabels = Object.fromEntries(
    getMealTypeOptions(locale)
      .filter((option) => option.value !== "all")
      .map((option) => [option.value, option.label])
  ) as Record<MealType, string>;
  const MealIcon = MEAL_TYPE_META[form.meal_type].icon;
  const ingredients = form.ingredients.filter((item) => item.name.trim());
  const macros: MealMacros = form.macros;

  const handleRefine = () => {
    const trimmed = specification.trim();
    if (trimmed.length < 3) return;
    onRefineWithSpecification?.(trimmed);
  };

  const sheet = (
    <div className="relative z-10 mt-auto min-h-0 max-h-[min(72dvh,640px)] overflow-y-auto overscroll-contain rounded-t-[1.35rem] border border-border/80 bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-5 text-card-foreground shadow-2xl">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/40" aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          {platform.mealLog.identifiedByItem}
          {confidence != null ? (
            <span className="ml-1 normal-case tracking-normal">
              <ConfidenceBadge confidence={confidence} />
            </span>
          ) : null}
        </p>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={() => setIsEditing((value) => !value)}
            disabled={isRefining || isSaving}
            aria-label={platform.common.edit}
            aria-pressed={isEditing}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <h3 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground">
        {form.name}
      </h3>

      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
        <MealIcon className="h-3.5 w-3.5" />
        {mealTypeLabels[form.meal_type]}
      </span>

      {form.description && !isEditing ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{form.description}</p>
      ) : null}

      {!isEditing ? (
        <>
          {ingredients.length > 0 ? (
            <ul className="mt-5 divide-y divide-border border-t border-border">
              {ingredients.map((ingredient, index) => (
                <li
                  key={`${ingredient.name}-${index}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {ingredient.name}
                  </span>
                  {ingredient.amount ? (
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {ingredient.amount}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {platform.mealLog.caloriesLabel}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-black tabular-nums leading-none">
                  {macros.calories}
                </span>
                <span className="text-sm font-bold uppercase text-muted-foreground">kcal</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <MacroMiniRing
                label={platform.ai.protein}
                value={macros.protein}
                ringClass="border-rose-500"
              />
              <MacroMiniRing
                label={platform.ai.carbs}
                value={macros.carbs}
                ringClass="border-amber-400"
              />
              <MacroMiniRing
                label={platform.ai.fat}
                value={macros.fat}
                ringClass="border-sky-500"
              />
            </div>
          </div>
        </>
      ) : null}

      {isEditing && onFormChange ? (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
          <MealDetailsFields
            mealType={form.meal_type}
            onMealTypeChange={(meal_type) => onFormChange({ ...form, meal_type })}
            name={form.name}
            onNameChange={(name) => onFormChange({ ...form, name })}
            description={form.description}
            onDescriptionChange={(description) =>
              onFormChange({ ...form, description })
            }
            macros={form.macros}
            onMacrosChange={(macros) => onFormChange({ ...form, macros })}
            ingredients={form.ingredients}
            onIngredientsChange={(ingredients) =>
              onFormChange({ ...form, ingredients })
            }
          />
        </div>
      ) : null}

      {isEditing && onRefineWithSpecification ? (
        <div className="mt-4 rounded-2xl border border-primary/35 bg-primary/10 p-4">
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
      ) : null}

      {onSave ? (
        <Button
          type="button"
          className="mt-6 w-full"
          disabled={isSaving || isRefining}
          onClick={onSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {platform.common.saving}
            </>
          ) : (
            saveLabel ?? platform.mealLog.continueMeal
          )}
        </Button>
      ) : null}

      {onRetake ? (
        <button
          type="button"
          className="mt-3 w-full py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          onClick={onRetake}
          disabled={retakeDisabled}
        >
          {platform.mealLog.retakePhoto}
        </button>
      ) : null}

      {onSecondary && secondaryLabel ? (
        <button
          type="button"
          className="mt-1 w-full py-2 text-center text-sm font-semibold text-primary transition-colors hover:brightness-110 disabled:opacity-50"
          onClick={onSecondary}
          disabled={secondaryDisabled}
        >
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={platform.mealLog.mealPreview}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-background" aria-hidden />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background"
        aria-hidden
      />
      {sheet}
    </div>
  );
}
