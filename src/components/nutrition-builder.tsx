"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createNutritionPlan,
  saveMeal,
  assignNutritionPlan,
} from "@/lib/actions/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MealType } from "@/lib/types";

interface MealForm {
  id?: string;
  meal_type: MealType;
  name: string;
  foods: { name: string; amount: string }[];
}

export function NutritionBuilder({
  planId: initialPlanId,
  initialTitle = "",
  initialDescription = "",
  initialMacros = { target_calories: 2000, target_protein: 150, target_carbs: 200, target_fat: 65 },
  initialMeals = [],
  clientId,
  requestId,
}: {
  planId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialMacros?: { target_calories: number; target_protein: number; target_carbs: number; target_fat: number };
  initialMeals?: MealForm[];
  clientId?: string;
  requestId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(initialPlanId);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [macros, setMacros] = useState(initialMacros);
  const [meals, setMeals] = useState<MealForm[]>(
    initialMeals.length > 0
      ? initialMeals
      : [{ meal_type: "breakfast", name: "Breakfast", foods: [{ name: "", amount: "" }] }]
  );

  const addMeal = () => {
    setMeals([...meals, { meal_type: "lunch", name: "New Meal", foods: [{ name: "", amount: "" }] }]);
  };

  const addFood = (mealIdx: number) => {
    const updated = [...meals];
    updated[mealIdx].foods.push({ name: "", amount: "" });
    setMeals(updated);
  };

  const handleSave = () => {
    startTransition(async () => {
      let currentPlanId = planId;
      if (!currentPlanId) {
        const result = await createNutritionPlan({ title, description, ...macros });
        if (result.error || !result.data) return;
        currentPlanId = result.data.id;
        setPlanId(currentPlanId);
      }

      for (let i = 0; i < meals.length; i++) {
        const meal = meals[i];
        await saveMeal(
          currentPlanId!,
          {
            meal_type: meal.meal_type,
            name: meal.name,
            foods: meal.foods.filter((f) => f.name.trim()),
            order_index: i,
          },
          meal.id
        );
      }

      if (clientId && currentPlanId) {
        await assignNutritionPlan(clientId, currentPlanId, requestId);
        router.push(`/admin/clients/${clientId}`);
      } else {
        router.push(`/admin/nutrition/${currentPlanId}/edit`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["target_calories", "target_protein", "target_carbs", "target_fat"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label className="capitalize">{key.replace("target_", "")}</Label>
                <Input
                  type="number"
                  value={macros[key]}
                  onChange={(e) =>
                    setMacros({ ...macros, [key]: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {meals.map((meal, mealIdx) => (
        <Card key={mealIdx}>
          <CardHeader className="flex flex-row gap-3">
            <select
              value={meal.meal_type}
              onChange={(e) => {
                const updated = [...meals];
                updated[mealIdx].meal_type = e.target.value as MealType;
                setMeals(updated);
              }}
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <Input
              value={meal.name}
              onChange={(e) => {
                const updated = [...meals];
                updated[mealIdx].name = e.target.value;
                setMeals(updated);
              }}
              className="font-semibold"
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {meal.foods.map((food, foodIdx) => (
              <div key={foodIdx} className="flex gap-2">
                <Input
                  placeholder="Food"
                  value={food.name}
                  onChange={(e) => {
                    const updated = [...meals];
                    updated[mealIdx].foods[foodIdx].name = e.target.value;
                    setMeals(updated);
                  }}
                />
                <Input
                  placeholder="Amount"
                  value={food.amount}
                  onChange={(e) => {
                    const updated = [...meals];
                    updated[mealIdx].foods[foodIdx].amount = e.target.value;
                    setMeals(updated);
                  }}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addFood(mealIdx)}>
              <Plus className="mr-1 h-3 w-3" /> Add Food
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={addMeal}>
          <Plus className="mr-2 h-4 w-4" /> Add Meal
        </Button>
        <Button onClick={handleSave} disabled={isPending || !title.trim()}>
          {clientId ? "Save & Assign to Client" : "Save Plan"}
        </Button>
      </div>
    </div>
  );
}
