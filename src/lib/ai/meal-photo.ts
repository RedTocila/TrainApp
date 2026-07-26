import type { MealType } from "@/lib/types";
import type { MealFormData, MealIngredient } from "@/lib/meal-utils";
import { runVisionPrompt } from "@/lib/ai/providers";
import { clampConfidence, parseJsonObject, roundMacro } from "@/lib/ai/parse-json";
import type { MealAnalysisResult } from "@/lib/ai/types";

export type { MealAnalysisResult };

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function buildPhotoPrompt(locale?: string | null): string {
  const language =
    locale === "al"
      ? "Write alex_message in Albanian (shqip)."
      : "Write alex_message in English.";

  return `You are Coach Alex — a sarcastic, darkly funny personal trainer and nutrition coach inside a fitness app. You talk like the coach who roasts soft excuses between sets but still makes sure people get results.

First decide: is this photo something a person would eat or drink (a meal, snack, food, beverage, or other consumable)?

VALID food/drink examples: plated meals, packaged snacks, fruits, smoothies, coffee, protein shakes, desserts, takeout, leftovers, groceries clearly intended as a meal portion.

INVALID examples: people, pets, cars, rooms, memes, screenshots, documents, gym equipment, random objects, landscapes, selfies, empty plates with nothing edible, medicine/supplements that are clearly not a meal photo (pills bottle alone), anything that is not food or drink.

Tasks:
1. If INVALID — set valid=false. Do NOT invent macros or ingredients. Write alex_message as a short sarcastic roast (1–3 sentences) calling out that this is not food. ${language} Roast the attempt, not their worth as a person. No cruel insults.
2. If VALID — set valid=true. alex_message can be omitted or empty. Analyze the meal: identify foods, estimate portions, calculate macros.

Respond with ONLY valid JSON (no markdown):
{
  "valid": true | false,
  "alex_message": "string (required when valid=false; empty when valid=true)",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "name": "short meal name",
  "description": "one sentence describing what you see",
  "confidence": number between 0 and 1,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "ingredients": [{ "name": "food item", "amount": "estimated portion e.g. 150g, 1 cup, 2 eggs" }]
}

When valid=false: set name to "", description to "", confidence to 0, all macros to 0, ingredients to [].
When valid=true: use whole numbers for macros. confidence should reflect image clarity and portion certainty.`;
}

function parseMealAnalysis(raw: string): MealAnalysisResult {
  const parsed = parseJsonObject<{
    valid?: boolean;
    alex_message?: string;
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

  const valid = parsed.valid !== false;
  const alex_message = parsed.alex_message?.trim() || undefined;

  if (!valid) {
    return {
      valid: false,
      alex_message:
        alex_message ||
        "That's not food. Try again when you have something edible in the frame.",
      meal_type: "snack",
      name: "",
      description: "",
      confidence: 0,
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ingredients: [],
    };
  }

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
    valid: true,
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
  mimeType: string,
  locale?: string | null
): Promise<MealAnalysisResult> {
  const raw = await runVisionPrompt(
    buildPhotoPrompt(locale),
    imageBase64,
    mimeType
  );
  return parseMealAnalysis(raw);
}

function buildRefinePhotoPrompt(
  specification: string,
  previousResult?: MealAnalysisResult,
  locale?: string | null
): string {
  let prompt = buildPhotoPrompt(locale);

  prompt += `\n\nThe user reviewed your analysis and provided corrections or extra details. Use them when estimating:\n"${specification.trim()}"`;

  if (previousResult) {
    prompt += `\n\nYour previous analysis was:
${JSON.stringify(
  {
    meal_type: previousResult.meal_type,
    name: previousResult.name,
    description: previousResult.description,
    confidence: previousResult.confidence,
    calories: previousResult.macros.calories,
    protein: previousResult.macros.protein,
    carbs: previousResult.macros.carbs,
    fat: previousResult.macros.fat,
    ingredients: previousResult.ingredients,
  },
  null,
  2
)}

Refine this estimate using the photo and the user's notes. The photo must still be food/drink — if it is not, set valid=false.`;
  }

  return prompt;
}

export async function refineMealPhoto(
  imageBase64: string,
  mimeType: string,
  specification: string,
  previousResult?: MealAnalysisResult,
  locale?: string | null
): Promise<MealAnalysisResult> {
  const trimmed = specification.trim();
  if (trimmed.length < 3) {
    throw new Error("Add a few details for AI to adjust the analysis");
  }

  const prompt = buildRefinePhotoPrompt(trimmed, previousResult, locale);
  const raw = await runVisionPrompt(prompt, imageBase64, mimeType);
  return parseMealAnalysis(raw);
}
