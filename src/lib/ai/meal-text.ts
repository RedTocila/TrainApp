import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject, roundMacro, clampConfidence } from "@/lib/ai/parse-json";
import { mealAnalysisToForm, type MealAnalysisResult } from "@/lib/ai/meal-photo";
import type { MealType } from "@/lib/types";
import type { MealIngredient } from "@/lib/meal-utils";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const TEXT_PROMPT = (input: string) => `You are a nutrition assistant. Parse this natural language meal description and estimate macros.

User input: "${input}"

Extract foods, estimate quantities, and calculate totals.

Respond with ONLY valid JSON (no markdown):
{
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "name": "short meal name",
  "description": "brief summary of parsed foods",
  "confidence": number between 0 and 1,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "ingredients": [{ "name": "food", "amount": "quantity e.g. 2 eggs, 1 banana" }]
}

Use whole numbers for macros. Infer meal_type from context if possible.`;

export async function analyzeMealText(input: string): Promise<MealAnalysisResult> {
  const trimmed = input.trim();
  if (trimmed.length < 3) {
    throw new Error("Describe what you ate (at least 3 characters)");
  }

  const raw = await runTextPrompt(TEXT_PROMPT(trimmed), { maxTokens: 800, json: true });
  const parsed = parseJsonObject<{
    meal_type?: string;
    name?: string;
    description?: string;
    confidence?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    ingredients?: { name?: string; amount?: string }[];
  }>(raw);

  const meal_type = MEAL_TYPES.includes(parsed.meal_type as MealType)
    ? (parsed.meal_type as MealType)
    : "snack";

  const ingredients: MealIngredient[] = (parsed.ingredients ?? [])
    .filter((item) => item.name?.trim())
    .map((item) => ({
      name: item.name!.trim(),
      amount: item.amount?.trim() || undefined,
    }));

  return {
    meal_type,
    name: parsed.name?.trim() || trimmed.slice(0, 60),
    description: parsed.description?.trim() || trimmed,
    confidence: clampConfidence(parsed.confidence),
    macros: {
      calories: roundMacro(parsed.calories),
      protein: roundMacro(parsed.protein),
      carbs: roundMacro(parsed.carbs),
      fat: roundMacro(parsed.fat),
    },
    ingredients: ingredients.length > 0 ? ingredients : [{ name: trimmed, amount: "" }],
  };
}

export { mealAnalysisToForm };
