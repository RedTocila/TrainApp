import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { DAILY_MICRO_TARGETS } from "@/lib/nutrition-day-utils";
import {
  fallbackMacroOverageInsight,
  listOverTargetNutrients,
  mealFoodNames,
  mealMacroValue,
  nutrientLabel,
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
} from "@/lib/macro-overage-local";
import type { MealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";

export type {
  MacroOverageInsight,
  OverageNutrient,
} from "@/lib/macro-overage-local";
export {
  buildLocalDayOverageInsights,
  fallbackMacroOverageInsight,
  listOverTargetNutrients,
  nutrientLabel,
  nutrientUnit,
} from "@/lib/macro-overage-local";

export async function generateDayMacroOverageInsights({
  meals,
  current,
  targets,
  micros,
}: {
  meals: DailyMealLog[];
  current: MealMacros;
  targets: MealMacros;
  micros?: { sodium?: number; sugar?: number } | null;
}): Promise<MacroOverageInsight[]> {
  const nutrients = listOverTargetNutrients(current, targets, micros);
  if (nutrients.length === 0) return [];

  const fallbacks = nutrients.map((nutrient) =>
    fallbackMacroOverageInsight(meals, nutrient, targets)
  );
  if (meals.length === 0) return fallbacks;

  const mealLines = meals
    .map((meal, index) => {
      const foods = (meal.foods ?? [])
        .map((f) => (f.amount ? `${f.name} (${f.amount})` : f.name))
        .filter(Boolean)
        .join(", ");
      return `${index + 1}. id=${meal.id} | "${meal.name}" | ${meal.meal_type} | ${meal.calories} kcal P${meal.protein}g C${meal.carbs}g F${meal.fat}g${
        foods ? ` | foods: ${foods}` : ""
      }${meal.description ? ` | note: ${meal.description}` : ""}`;
    })
    .join("\n");

  const overLines = nutrients
    .map((nutrient) => {
      const unit = nutrientUnit(nutrient);
      const label = nutrientLabel(nutrient);
      const target =
        nutrient === "sodium"
          ? DAILY_MICRO_TARGETS.sodium
          : nutrient === "sugar"
            ? DAILY_MICRO_TARGETS.sugar
            : targets[nutrient];
      const consumed =
        nutrient === "sodium" || nutrient === "sugar"
          ? meals.reduce((sum, meal) => sum + mealMacroValue(meal, nutrient), 0)
          : current[nutrient];
      return `- ${label}: ${Math.round(consumed)}${unit} logged vs ${Math.round(target)}${unit} target`;
    })
    .join("\n");

  const prompt = `You are a fitness nutrition coach. The client went over on one or more nutrients.
For EACH overshot nutrient below, name the specific logged meal and the foods in that meal that caused most of the excess, so they know what to fix next time.

Over limits:
${overLines}

Daily totals: ${current.calories} kcal / ${current.protein}g P / ${current.carbs}g C / ${current.fat}g F
Targets: ${targets.calories} kcal / ${targets.protein}g P / ${targets.carbs}g C / ${targets.fat}g F

Logged meals:
${mealLines}

Respond with ONLY valid JSON:
{
  "insights": [
    {
      "nutrient": "fat|calories|protein|carbs|sodium|sugar",
      "culpritMealId": "exact meal id from the list, or null",
      "culpritMealName": "meal name",
      "amountFromMeal": number,
      "problemFoods": ["food 1", "food 2"],
      "explanation": "2 short sentences naming the meal and foods that drove this overshoot",
      "avoidNextTime": "1 concrete sentence about what to eat less of / swap next time"
    }
  ]
}`;

  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 1200, json: true });
    const parsed = parseJsonObject<{
      insights?: Array<{
        nutrient?: string;
        culpritMealId?: string | null;
        culpritMealName?: string;
        amountFromMeal?: number;
        problemFoods?: string[];
        explanation?: string;
        avoidNextTime?: string;
      }>;
    }>(raw);

    const byNutrient = new Map(
      (parsed.insights ?? [])
        .filter((row) => row.nutrient)
        .map((row) => [row.nutrient as string, row])
    );

    return nutrients.map((nutrient, index) => {
      const fallback = fallbacks[index]!;
      const row = byNutrient.get(nutrient);
      if (!row) return fallback;

      const matched =
        row.culpritMealId != null
          ? meals.find((meal) => meal.id === row.culpritMealId)
          : meals.find(
              (meal) =>
                meal.name.toLowerCase() ===
                (row.culpritMealName ?? "").trim().toLowerCase()
            );

      const foods =
        row.problemFoods?.map((f) => f.trim()).filter(Boolean).slice(0, 5) ??
        (matched ? mealFoodNames(matched).slice(0, 5) : fallback.problemFoods);

      return {
        nutrient,
        culpritMealId:
          matched?.id ?? row.culpritMealId ?? fallback.culpritMealId,
        culpritMealName:
          matched?.name ??
          row.culpritMealName?.trim() ??
          fallback.culpritMealName,
        amountFromMeal:
          typeof row.amountFromMeal === "number"
            ? Math.round(row.amountFromMeal)
            : matched
              ? Math.round(mealMacroValue(matched, nutrient))
              : fallback.amountFromMeal,
        problemFoods: foods.length ? foods : fallback.problemFoods,
        explanation: row.explanation?.trim() || fallback.explanation,
        avoidNextTime: row.avoidNextTime?.trim() || fallback.avoidNextTime,
      };
    });
  } catch {
    return fallbacks;
  }
}

export async function generateMacroOverageInsight({
  meals,
  nutrient,
  current,
  targets,
}: {
  meals: DailyMealLog[];
  nutrient: OverageNutrient;
  current: MealMacros;
  targets: MealMacros;
}): Promise<MacroOverageInsight> {
  const micros =
    nutrient === "sodium"
      ? {
          sodium: meals.reduce(
            (sum, meal) => sum + mealMacroValue(meal, "sodium"),
            0
          ),
        }
      : nutrient === "sugar"
        ? {
            sugar: meals.reduce(
              (sum, meal) => sum + mealMacroValue(meal, "sugar"),
              0
            ),
          }
        : null;

  const insights = await generateDayMacroOverageInsights({
    meals,
    current,
    targets,
    micros,
  });
  const match = insights.find((insight) => insight.nutrient === nutrient);
  return match ?? fallbackMacroOverageInsight(meals, nutrient, targets);
}
