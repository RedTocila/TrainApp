"use client";

import { useCallback, useEffect, useState } from "react";
import type { MealType } from "@/lib/types";

export type RecipeListItem = {
  id: string;
  title: string;
  meal_type: MealType;
  description: string;
  ingredients: { name: string; amount?: string }[];
  ingredientCount: number;
};

export function useRecipeCatalog(
  mealType: MealType | "all" = "all",
  limit = 40,
  enabled = true
) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, mealType]);

  const fetchRecipes = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        q: debouncedQuery,
        mealType,
      });
      const res = await fetch(`/api/recipe-catalog?${params}`);
      if (!res.ok) throw new Error("Failed to load recipes");
      const data = await res.json();
      setRecipes(data.recipes ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRecipes([]);
      setTotal(0);
      setError("Could not load recipes.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, mealType, limit, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchRecipes();
  }, [fetchRecipes, enabled]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    query,
    setQuery,
    page,
    setPage,
    recipes,
    total,
    loading,
    error,
    totalPages,
  };
}
