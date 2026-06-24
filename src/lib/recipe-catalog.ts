import type { MealFormData, MealIngredient } from "@/lib/meal-utils";
import type { MealType } from "@/lib/types";

export interface CatalogRecipe {
  id: string;
  title: string;
  meal_type: MealType;
  ingredients: MealIngredient[];
  instructions: string;
  description: string;
}

export interface RecipeCatalog {
  source: string;
  attribution: string;
  count: number;
  recipes: CatalogRecipe[];
}

export function catalogRecipeToMealForm(recipe: CatalogRecipe): MealFormData {
  return {
    meal_type: recipe.meal_type,
    name: recipe.title,
    description: recipe.instructions,
    youtube_url: "",
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients
        : [{ name: "", amount: "" }],
  };
}

export function filterCatalogRecipes(
  recipes: CatalogRecipe[],
  {
    query = "",
    mealType = "all",
  }: { query?: string; mealType?: MealType | "all" }
): CatalogRecipe[] {
  const q = query.trim().toLowerCase();

  return recipes.filter((recipe) => {
    if (mealType !== "all" && recipe.meal_type !== mealType) return false;
    if (!q) return true;

    const haystack = [
      recipe.title,
      recipe.description,
      recipe.instructions,
      ...recipe.ingredients.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}
