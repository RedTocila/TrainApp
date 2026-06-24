"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChefHat } from "lucide-react";
import type { MealType } from "@/lib/types";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { NutritionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MyMealsPage } from "@/components/my-meals-page";
import { RecipeTemplatesPage } from "@/components/recipe-templates-page";

const MEAL_TABS: Array<{ value: MealType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snack", label: "Snack" },
  { value: "dinner", label: "Dinner" },
];

export function MealsHubPage({
  meals,
  folders,
  plans,
}: {
  meals: PersonalMealLibraryItem[];
  folders: { id: string; name: string }[];
  plans: NutritionPlan[];
}) {
  const [mode, setMode] = useState<"templates" | "my">("templates");
  const [mealType, setMealType] = useState<MealType | "all">("all");

  const filteredMeals = useMemo(() => {
    if (mealType === "all") return meals;
    return meals.filter((m) => m.meal.meal_type === mealType);
  }, [meals, mealType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("templates")}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors",
              mode === "templates"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Recipe book
          </button>
          <button
            type="button"
            onClick={() => setMode("my")}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors",
              mode === "my"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <ChefHat className="h-4 w-4" />
            My meals
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MEAL_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setMealType(t.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              mealType === t.value
                ? "border border-primary/30 bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "templates" ? (
        <RecipeTemplatesPage plans={plans} mealType={mealType} />
      ) : (
        <MyMealsPage
          initialMeals={filteredMeals}
          folders={folders}
          showMealTypeTabs={false}
          showFolderActions={false}
        />
      )}
    </div>
  );
}

