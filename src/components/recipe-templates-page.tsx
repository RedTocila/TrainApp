"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import type { NutritionPlan } from "@/lib/types";
import { createPersonalMeal } from "@/lib/actions/user-nutrition";
import type { MealType } from "@/lib/types";
import { catalogRecipeToMealForm, type CatalogRecipe } from "@/lib/recipe-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type RecipeListItem = {
  id: string;
  title: string;
  meal_type: MealType;
  description: string;
  ingredients: { name: string; amount?: string }[];
  ingredientCount: number;
};

export function RecipeTemplatesPage({
  plans,
  mealType,
}: {
  plans: NutritionPlan[];
  mealType?: MealType | "all";
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [targetPlanId, setTargetPlanId] = useState(plans[0]?.id ?? "");
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const limit = 40;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, mealType]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        q: debouncedQuery,
        mealType: mealType ?? "all",
      });
      const res = await fetch(`/api/recipe-catalog?${params}`);
      if (!res.ok) throw new Error("Failed to load recipes");
      const data = await res.json();
      setRecipes(data.recipes ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRecipes([]);
      setTotal(0);
      setMessage("Could not load recipe templates. Run npm run sync:recipes.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, mealType]);

  useEffect(() => {
    void fetchRecipes();
  }, [fetchRecipes]);

  const canAdd = !!targetPlanId;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const addTemplate = (recipeId: string) => {
    if (!targetPlanId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/recipe-catalog?id=${encodeURIComponent(recipeId)}`);
      if (!res.ok) {
        setMessage("Recipe not found");
        return;
      }
      const data = (await res.json()) as { recipe: CatalogRecipe };
      const result = await createPersonalMeal(
        targetPlanId,
        catalogRecipeToMealForm(data.recipe)
      );
      if ("error" in result && result.error) setMessage(result.error);
      else setMessage(`Added: ${data.recipe.title}`);
    });
  };

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

            <div className="flex items-center gap-2 sm:justify-end">
              <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                Add to
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
          </div>

          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} recipes · Epicurious dataset
          </p>

          {!canAdd && (
            <p className="text-sm text-muted-foreground">
              Create a meal plan first, then you can add recipes into it.
            </p>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
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
                  disabled={!canAdd || isPending}
                  onClick={() => addTemplate(recipe.id)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add to meal plan
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
