import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  filterCatalogRecipes,
  type RecipeCatalog,
} from "@/lib/recipe-catalog";
import type { MealType } from "@/lib/types";

let cachedCatalog: RecipeCatalog | null = null;

function loadCatalog(): RecipeCatalog {
  if (cachedCatalog) return cachedCatalog;
  const path = join(process.cwd(), "src/data/recipe-catalog.json");
  cachedCatalog = JSON.parse(readFileSync(path, "utf8")) as RecipeCatalog;
  return cachedCatalog;
}

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack", "all"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  const catalog = loadCatalog();

  if (id) {
    const recipe = catalog.recipes.find((r) => r.id === id);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  }

  const query = searchParams.get("q") ?? "";
  const mealTypeParam = searchParams.get("mealType") ?? "all";
  const mealType = MEAL_TYPES.has(mealTypeParam)
    ? (mealTypeParam as MealType | "all")
    : "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    60,
    Math.max(10, Number(searchParams.get("limit") ?? "40") || 40)
  );

  const filtered = filterCatalogRecipes(catalog.recipes, { query, mealType });
  const total = filtered.length;
  const start = (page - 1) * limit;
  const recipes = filtered.slice(start, start + limit).map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    meal_type: recipe.meal_type,
    description: recipe.description,
    ingredients: recipe.ingredients.slice(0, 6),
    ingredientCount: recipe.ingredients.length,
  }));

  return NextResponse.json(
    {
      source: catalog.source,
      attribution: catalog.attribution,
      total,
      count: catalog.count,
      page,
      limit,
      recipes,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
