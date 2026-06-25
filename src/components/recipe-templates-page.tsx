"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import type { NutritionPlan } from "@/lib/types";
import {
  createPersonalMeal,
  ensureDefaultRecipeCollectionPlan,
} from "@/lib/actions/user-nutrition";
import type { MealType } from "@/lib/types";
import { catalogRecipeToMealForm, type CatalogRecipe } from "@/lib/recipe-catalog";
import { useRecipeCatalog } from "@/hooks/use-recipe-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function RecipeTemplatesPage({
  plans: initialPlans,
  mealType,
}: {
  plans: NutritionPlan[];
  mealType?: MealType | "all";
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [targetPlanId, setTargetPlanId] = useState(initialPlans[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const {
    query,
    setQuery,
    page,
    setPage,
    recipes,
    total,
    loading,
    error,
    totalPages,
  } = useRecipeCatalog(mealType ?? "all");

  useEffect(() => {
    setPlans(initialPlans);
    if (initialPlans.length > 0 && !targetPlanId) {
      setTargetPlanId(initialPlans[0].id);
    }
  }, [initialPlans, targetPlanId]);

  const resolveTargetPlanId = async (): Promise<string | null> => {
    if (targetPlanId) return targetPlanId;

    const ensured = await ensureDefaultRecipeCollectionPlan();
    if ("error" in ensured) {
      setMessage(ensured.error);
      return null;
    }

    setTargetPlanId(ensured.planId);
    if (plans.length === 0) {
      setPlans([
        {
          id: ensured.planId,
          title: "Saved recipes",
          description: "Recipes saved from the recipe book",
          target_calories: 2000,
          target_protein: 150,
          target_carbs: 200,
          target_fat: 65,
          created_by: "",
          is_personal: true,
          folder_id: null,
          trainer_label: null,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    return ensured.planId;
  };

  const addTemplate = (recipeId: string) => {
    setMessage(null);
    startTransition(async () => {
      const planId = await resolveTargetPlanId();
      if (!planId) return;

      const res = await fetch(`/api/recipe-catalog?id=${encodeURIComponent(recipeId)}`);
      if (!res.ok) {
        setMessage("Recipe not found");
        return;
      }
      const data = (await res.json()) as { recipe: CatalogRecipe };
      const result = await createPersonalMeal(
        planId,
        catalogRecipeToMealForm(data.recipe)
      );
      if ("error" in result && result.error) setMessage(result.error);
      else setMessage(`Saved: ${data.recipe.title}`);
    });
  };

  const showPlanPicker = plans.length > 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 13k recipes…"
                className="w-full"
              />
            </div>

            {showPlanPicker && (
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                  Save to
                </span>
                <select
                  value={targetPlanId}
                  onChange={(e) => setTargetPlanId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-secondary px-3 text-sm sm:w-[260px]"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} recipes · Epicurious dataset
          </p>

          {(message || error) && (
            <p className="text-sm text-muted-foreground">{message ?? error}</p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading recipes…
        </div>
      ) : recipes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No recipes match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Card key={recipe.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-semibold">{recipe.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {recipe.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                    {recipe.meal_type}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {recipe.ingredients.slice(0, 4).map((ingredient, idx) => (
                    <span
                      key={`${recipe.id}-${idx}`}
                      className="rounded-lg bg-secondary/50 px-2 py-1 text-[11px]"
                    >
                      {ingredient.name}
                    </span>
                  ))}
                  {recipe.ingredientCount > 4 && (
                    <span className="rounded-lg bg-secondary/30 px-2 py-1 text-[11px] text-muted-foreground">
                      +{recipe.ingredientCount - 4} more
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  disabled={isPending}
                  onClick={() => addTemplate(recipe.id)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Save recipe
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
