import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildCoachLanguageInstructions } from "@/lib/ai/language-instructions";
import { NUTRITION_ACCURACY_RULES } from "@/lib/ai/nutrition-accuracy";
import { DAILY_MICRO_TARGETS } from "@/lib/nutrition-day-utils";
import {
  fallbackMacroOverageInsight,
  listOverTargetNutrients,
  mealMacroValue,
  nutrientLabel,
  nutrientUnit,
  type MacroOverageInsight,
  type OverageNutrient,
  type OverageTipCopy,
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
  locale,
  tips,
}: {
  meals: DailyMealLog[];
  current: MealMacros;
  targets: MealMacros;
  micros?: { sodium?: number; sugar?: number } | null;
  locale?: string | null;
  tips?: OverageTipCopy;
}): Promise<MacroOverageInsight[]> {
  const nutrients = listOverTargetNutrients(current, targets, micros);
  if (nutrients.length === 0) return [];

  const fallbacks = nutrients.map((nutrient) =>
    fallbackMacroOverageInsight(meals, nutrient, targets, tips)
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
For EACH overshot nutrient, pick the ONE logged meal that drove most of the excess and give a short rebalance tip.

${NUTRITION_ACCURACY_RULES}

Tone rules (critical):
- Do NOT list ingredients as banned foods or "foods to avoid".
- Never make them feel they cannot eat that meal again.
- Focus on portions and balance for THIS day — what made the macros tip over.
- Keep wording short and direct. No filler.
- avoidNextTime must match the nutrient: e.g. for carbs/sugar talk portions of starch/sweets; for fat talk oils/sauces/cheese — never suggest nuts to "add protein".

Over limits:
${overLines}

Daily totals: ${current.calories} kcal / ${current.protein}g P / ${current.carbs}g C / ${current.fat}g F
Targets: ${targets.calories} kcal / ${targets.protein}g P / ${targets.carbs}g C / ${targets.fat}g F

Logged meals:
${mealLines}

${buildCoachLanguageInstructions(locale)}
Write explanation and avoidNextTime in the app language preference above.
- culpritMealName must be the EXACT meal name string from Logged meals (character-for-character). Never translate or rewrite it.
- explanation: max 1 short sentence (optional detail; UI may hide it)
- avoidNextTime: max 8–12 words. Action tip only. No long explanations.

Respond with ONLY valid JSON:
{
  "insights": [
    {
      "nutrient": "fat|calories|protein|carbs|sodium|sugar",
      "culpritMealId": "exact meal id from the list, or null",
      "culpritMealName": "exact meal name from Logged meals",
      "amountFromMeal": number,
      "explanation": "ONE short sentence naming the meal impact.",
      "avoidNextTime": "Very short tip (e.g. smaller dried fruit portion)."
    }
  ]
}`;

  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 900, json: true });
    const parsed = parseJsonObject<{
      insights?: Array<{
        nutrient?: string;
        culpritMealId?: string | null;
        culpritMealName?: string;
        amountFromMeal?: number;
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
        problemFoods: [],
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
  locale,
  tips,
}: {
  meals: DailyMealLog[];
  nutrient: OverageNutrient;
  current: MealMacros;
  targets: MealMacros;
  locale?: string | null;
  tips?: OverageTipCopy;
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
    locale,
    tips,
  });
  const match = insights.find((insight) => insight.nutrient === nutrient);
  return match ?? fallbackMacroOverageInsight(meals, nutrient, targets, tips);
}
