import type { MealType } from "@/lib/types";
import type { MealFormData, MealIngredient } from "@/lib/meal-utils";
import { runVisionPrompt } from "@/lib/ai/providers";
import { clampConfidence, parseJsonObject, roundMacro } from "@/lib/ai/parse-json";
import type { MealAnalysisResult } from "@/lib/ai/types";

export type { MealAnalysisResult };

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const PHOTO_PROMPT = `You are a nutrition assistant. Analyze the meal in this photo.

Identify each food item, estimate portion sizes, and calculate total macros.

Respond with ONLY valid JSON (no markdown):
{
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "name": "short meal name",
  "description": "one sentence describing what you see",
  "confidence": number between 0 and 1 (how confident you are in the estimate),
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "ingredients": [{ "name": "food item", "amount": "estimated portion e.g. 150g, 1 cup, 2 eggs" }]
}

Use whole numbers for macros. confidence should reflect image clarity and portion certainty.`;

function parseMealAnalysis(raw: string): MealAnalysisResult {
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
    name: parsed.name?.trim() || "Meal",
    description: parsed.description?.trim() || "",
    confidence: clampConfidence(parsed.confidence),
    macros: {
      calories: roundMacro(parsed.calories),
      protein: roundMacro(parsed.protein),
      carbs: roundMacro(parsed.carbs),
      fat: roundMacro(parsed.fat),
    },
    ingredients: ingredients.length > 0 ? ingredients : [{ name: "", amount: "" }],
  };
}

export function mealAnalysisToForm(result: MealAnalysisResult): MealFormData {
  return {
    meal_type: result.meal_type,
    name: result.name,
    description: result.description,
    macros: result.macros,
    ingredients: result.ingredients,
  };
}

export async function analyzeMealPhoto(
  imageBase64: string,
  mimeType: string
): Promise<MealAnalysisResult> {
  const raw = await runVisionPrompt(PHOTO_PROMPT, imageBase64, mimeType);
  return parseMealAnalysis(raw);
}
