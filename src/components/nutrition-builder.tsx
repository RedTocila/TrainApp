"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createNutritionPlan,
  saveMeal,
  assignNutritionPlan,
  deleteMeal,
} from "@/lib/actions/plans";
import { findDeliverablePlanRequest } from "@/lib/actions/custom-plans";
import {
  createPersonalNutritionPlan,
  updatePersonalNutritionPlan,
} from "@/lib/actions/user-nutrition";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  emptyMealForm,
  mealFormFromMeal,
  mealPayloadFromForm,
  type MealFormData,
} from "@/lib/meal-utils";
import type { MealType } from "@/lib/types";

interface MealForm extends MealFormData {
  id?: string;
}

function mealFormToBuilder(meal: {
  id?: string;
  meal_type: MealType;
  name: string;
  description?: string | null;
  youtube_url?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  foods?: { name: string; amount?: string }[];
}): MealForm {
  return { id: meal.id, ...mealFormFromMeal(meal) };
}

export function NutritionBuilder({
  planId: initialPlanId,
  initialTitle = "",
  initialDescription = "",
  initialMacros = { target_calories: 2000, target_protein: 150, target_carbs: 200, target_fat: 65 },
  initialMeals = [],
  clientId,
  requestId,
  mode = "admin",
  wizard = false,
  onWizardComplete,
  stayOnPage = false,
  onSaved,
  folderId,
}: {
  planId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialMacros?: { target_calories: number; target_protein: number; target_carbs: number; target_fat: number };
  initialMeals?: Array<{
    id?: string;
    meal_type: MealType;
    name: string;
    description?: string | null;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    foods?: { name: string; amount?: string }[];
  }>;
  clientId?: string;
  requestId?: string;
  mode?: "admin" | "client";
  wizard?: boolean;
  onWizardComplete?: () => void;
  stayOnPage?: boolean;
  onSaved?: () => void;
  folderId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(initialPlanId);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [macros, setMacros] = useState(initialMacros);
  const [meals, setMeals] = useState<MealForm[]>(
    initialMeals.length > 0
      ? initialMeals.map(mealFormToBuilder)
      : [{ ...emptyMealForm("breakfast"), name: "Breakfast" }]
  );
  const [error, setError] = useState<string | null>(null);

  const updateMeal = (mealIdx: number, next: MealFormData) => {
    const updated = [...meals];
    updated[mealIdx] = { ...updated[mealIdx], ...next };
    setMeals(updated);
  };

  const addMeal = () => {
    setMeals([...meals, { ...emptyMealForm("lunch"), name: "New Meal" }]);
  };

  const removeMeal = (mealIdx: number) => {
    const meal = meals[mealIdx];
    if (meal.id && planId) {
      startTransition(async () => {
        await deleteMeal(meal.id!, planId);
      });
    }
    setMeals(meals.filter((_, i) => i !== mealIdx));
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError("Plan title is required");
      return;
    }
    setError(null);

    startTransition(async () => {
      let currentPlanId = planId;

      if (mode === "client") {
        if (!currentPlanId) {
          const result = await createPersonalNutritionPlan(
            title,
            description,
            macros,
            folderId
          );
          if (result.error || !result.data) {
            setError(result.error ?? "Failed to create plan");
            return;
          }
          currentPlanId = result.data.id;
          setPlanId(currentPlanId);
        } else {
          const result = await updatePersonalNutritionPlan(currentPlanId, {
            title,
            description,
            ...macros,
          });
          if (result.error) {
            setError(result.error);
            return;
          }
        }
      } else if (!currentPlanId) {
        const result = await createNutritionPlan({ title, description, ...macros });
        if (result.error || !result.data) {
          setError(result.error ?? "Failed to create plan");
          return;
        }
        currentPlanId = result.data.id;
        setPlanId(currentPlanId);
      }

      for (let i = 0; i < meals.length; i++) {
        const meal = meals[i];
        const saveResult = await saveMeal(
          currentPlanId!,
          {
            ...mealPayloadFromForm(meal),
            order_index: i,
          },
          meal.id
        );
        if (saveResult.error) {
          setError(saveResult.error);
          return;
        }
      }

      if (clientId && currentPlanId) {
        const openRequest = requestId
          ? { id: requestId }
          : await findDeliverablePlanRequest(clientId, "diet");

        if (openRequest) {
          setError(
            "Custom nutrition plans are sent as PDF. Open the client request and use Upload PDF."
          );
          return;
        }

        await assignNutritionPlan(clientId, currentPlanId, requestId);
        router.push(`/admin/clients/${clientId}`);
        return;
      }

      if (wizard && onWizardComplete) {
        onWizardComplete();
        return;
      }

      if (stayOnPage) {
        onSaved?.();
        return;
      }

      if (mode === "client") {
        router.push(`/dashboard/nutrition/${currentPlanId}/edit`);
        router.refresh();
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
        <Card key={meal.id ?? mealIdx} className="relative">
          {meals.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10"
              onClick={() => removeMeal(mealIdx)}
              aria-label="Remove meal"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          )}
          <CardContent className="pt-6">
            <MealDetailsFields
              mealType={meal.meal_type}
              onMealTypeChange={(meal_type) => updateMeal(mealIdx, { ...meal, meal_type })}
              name={meal.name}
              onNameChange={(name) => updateMeal(mealIdx, { ...meal, name })}
              description={meal.description}
              onDescriptionChange={(description) => updateMeal(mealIdx, { ...meal, description })}
              youtubeUrl={meal.youtube_url}
              onYoutubeUrlChange={(youtube_url) => updateMeal(mealIdx, { ...meal, youtube_url })}
              macros={meal.macros}
              onMacrosChange={(macros) => updateMeal(mealIdx, { ...meal, macros })}
              ingredients={meal.ingredients}
              onIngredientsChange={(ingredients) => updateMeal(mealIdx, { ...meal, ingredients })}
            />
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={addMeal}>
          <Plus className="mr-2 h-4 w-4" /> Add Meal
        </Button>
        <Button onClick={handleSave} disabled={isPending || !title.trim()}>
          {clientId
            ? "Save & Assign to Client"
            : wizard
              ? "Save meal plan"
              : stayOnPage
                ? "Save changes"
                : "Save Plan"}
        </Button>
      </div>
    </div>
  );
}
