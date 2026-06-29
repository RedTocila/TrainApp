"use client";

import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import type { PlannedMealSlot } from "@/lib/meal-times";
import type { Meal } from "@/lib/types";
import { usePlatformCopy } from "@/components/locale-provider";

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

function MealRecipeSection({
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
  const { meal, slotLabel, timeWindow, optionLabel } = item;
  const macros = formatMealMacrosSummary(normalizeMealMacros(meal));
  const ingredients = (meal.foods ?? []).filter((food) => food.name.trim());

  return (
    <article className="space-y-3 border-b border-border/60 pb-8 last:border-b-0 last:pb-0">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {slotLabel}
          {optionLabel ? ` · ${optionLabel}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">{timeWindow}</p>
        <h3 className="text-lg font-bold leading-tight">{meal.name}</h3>
        {macros ? <p className="text-sm text-muted-foreground">{macros}</p> : null}
      </header>

      {ingredients.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {ingredientsLabel}
          </h4>
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {ingredients.map((ingredient, index) => (
              <li key={`${ingredient.name}-${index}`} className="flex gap-2">
                <span className="text-muted-foreground">·</span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{ingredient.name}</span>
                  {ingredient.amount ? (
                    <span className="text-muted-foreground"> — {ingredient.amount}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {meal.description?.trim() && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {howToCookLabel}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {meal.description}
          </p>
        </section>
      )}

      {meal.youtube_url && (
        <ExerciseVideoPlayer videoUrl={meal.youtube_url} title={meal.name} />
      )}

      {ingredients.length === 0 && !meal.description?.trim() && !meal.youtube_url && (
        <p className="text-sm text-muted-foreground">{noMealDetails}</p>
      )}
    </article>
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
    <div className="space-y-8">
      {items.map((item) => (
        <MealRecipeSection
          key={item.id}
          item={item}
          noMealDetails={mealPlan.noMealDetails}
          ingredientsLabel={mealPlan.ingredients}
          howToCookLabel={mealPlan.howToCook}
        />
      ))}
    </div>
  );
}
