"use client";

import { Plus } from "lucide-react";
import type { MealType } from "@/lib/types";
import type { MealIngredient, MealMacros } from "@/lib/meal-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MealDetailsFields({
  mealType,
  onMealTypeChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  macros,
  onMacrosChange,
  ingredients,
  onIngredientsChange,
  autoFocusName,
}: {
  mealType: MealType;
  onMealTypeChange: (value: MealType) => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  macros: MealMacros;
  onMacrosChange: (value: MealMacros) => void;
  ingredients: MealIngredient[];
  onIngredientsChange: (value: MealIngredient[]) => void;
  autoFocusName?: boolean;
}) {
  const updateIngredient = (
    index: number,
    field: keyof MealIngredient,
    value: string
  ) => {
    const next = [...ingredients];
    next[index] = { ...next[index], [field]: value };
    onIngredientsChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Type</Label>
        <select
          value={mealType}
          onChange={(e) => onMealTypeChange(e.target.value as MealType)}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus={autoFocusName}
        />
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          placeholder="Notes, prep tips, or how to serve"
        />
      </div>

      <div className="space-y-2">
        <Label>Macros</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { key: "calories", label: "Calories" },
              { key: "protein", label: "Protein (g)" },
              { key: "carbs", label: "Carbs (g)" },
              { key: "fat", label: "Fat (g)" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="number"
                min={0}
                value={macros[key]}
                onChange={(e) =>
                  onMacrosChange({
                    ...macros,
                    [key]: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ingredients</Label>
        {ingredients.map((ingredient, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Ingredient"
              value={ingredient.name}
              onChange={(e) => updateIngredient(i, "name", e.target.value)}
            />
            <Input
              placeholder="Amount"
              value={ingredient.amount ?? ""}
              onChange={(e) => updateIngredient(i, "amount", e.target.value)}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onIngredientsChange([...ingredients, { name: "", amount: "" }])
          }
        >
          <Plus className="mr-1 h-3 w-3" />
          Add ingredient
        </Button>
      </div>
    </div>
  );
}
