"use client";

import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import type { PlannedMealSlot } from "@/lib/meal-times";
import type { Meal } from "@/lib/types";
import { usePlatformCopy } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MealPlanItem = {
  id: string;
  meal: Meal;
  slotLabel: string;
  timeWindow: string;
  optionLabel?: string;
};

function buildMealItems(slots: PlannedMealSlot[], optionLabel: (n: number) => string): MealPlanItem[] {
  return slots.flatMap((entry) => {
    const meals =
      entry.options.length > 0 ? entry.options : entry.meal ? [entry.meal] : [];
    return meals.map((meal, index) => ({
      id: `${entry.slot}-${meal.id}`,
      meal,
      slotLabel: entry.label,
      timeWindow: entry.timeWindow,
      optionLabel: meals.length > 1 ? optionLabel(index + 1) : undefined,
    }));
  });
}

function MealPlanItemRow({
  item,
  noMealDetails,
  ingredientsLabel,
  howToCookLabel,
}: {
  item: MealPlanItem;
  noMealDetails: string;
  ingredientsLabel: string;
  howToCookLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { meal, slotLabel, timeWindow, optionLabel } = item;
  const macros = formatMealMacrosSummary(normalizeMealMacros(meal));
  const ingredients = (meal.foods ?? []).filter((food) => food.name.trim());

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/50 sm:px-4"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{slotLabel}</Badge>
            {optionLabel && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {optionLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold">{meal.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            {timeWindow}
          </p>
          {macros && !open && (
            <p className="mt-1 text-xs text-muted-foreground">{macros}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-3 py-4 sm:px-4">
          {macros && <p className="text-xs font-medium text-primary">{macros}</p>}

          {ingredients.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {ingredientsLabel}
              </p>
              <ul className="space-y-1.5">
                {ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.name}-${index}`}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span>{ingredient.name}</span>
                    {ingredient.amount && (
                      <span className="shrink-0 text-muted-foreground">{ingredient.amount}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meal.description?.trim() && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {howToCookLabel}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {meal.description}
              </p>
            </div>
          )}

          {meal.youtube_url && (
            <ExerciseVideoPlayer videoUrl={meal.youtube_url} title={meal.name} />
          )}

          {ingredients.length === 0 && !meal.description?.trim() && !meal.youtube_url && (
            <p className="text-sm text-muted-foreground">{noMealDetails}</p>
          )}
        </div>
      )}
    </li>
  );
}

export function MealPlanViewer({
  slots,
  emptyMessage,
}: {
  slots: PlannedMealSlot[];
  emptyMessage?: string;
}) {
  const platform = usePlatformCopy();
  const mealPlan = platform.mealPlan;
  const items = buildMealItems(slots, mealPlan.option);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage ?? mealPlan.noMealsScheduled}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <MealPlanItemRow
          key={item.id}
          item={item}
          noMealDetails={mealPlan.noMealDetails}
          ingredientsLabel={mealPlan.ingredients}
          howToCookLabel={mealPlan.howToCook}
        />
      ))}
    </ul>
  );
}
