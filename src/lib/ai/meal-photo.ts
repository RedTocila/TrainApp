import type { MealType } from "@/lib/types";
import type { MealFormData, MealIngredient } from "@/lib/meal-utils";
import { buildAlexMessageLanguageRule } from "@/lib/ai/language-instructions";
import { runVisionPrompt } from "@/lib/ai/providers";
import { clampConfidence, parseJsonObject, roundMacro } from "@/lib/ai/parse-json";
import type { MealAnalysisResult } from "@/lib/ai/types";

export type { MealAnalysisResult };

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function buildPhotoPrompt(locale?: string | null): string {
  const language = buildAlexMessageLanguageRule(locale);

  return `You are Coach Alex — a sarcastic, darkly funny personal trainer and nutrition coach inside a fitness app. You talk like the coach who roasts soft excuses between sets but still makes sure people get results.

First decide: is this photo something a person would eat or drink (a meal, snack, food, beverage, or other consumable)?

VALID food/drink examples: plated meals, bowls, packaged snacks, fruits, smoothies, coffee, protein shakes, desserts, takeout, leftovers, groceries clearly intended as a meal portion, bowls with powders/supplements scooped into them.

INVALID examples: people, pets, cars, rooms, memes, screenshots, documents, gym equipment, random objects, landscapes, selfies, empty plates with nothing edible, a lone supplement bottle with no meal/food in the frame, anything that is not food or drink.

CRITICAL — full inventory (do NOT take a short cut):
- Scan the ENTIRE image, including the background and edges — not only the main bowl/plate.
- Read package / tub / bag / box labels when visible (brand + product name). Prefer the label over guessing (e.g. "CREATINE", "Hercules" yogurt, "Protein Granola", chia bags).
- Users often place ingredient packages next to the meal so you can identify them. Treat those packages as part of the analysis when they clearly relate to what is in / on the meal.
- List EVERY distinct edible or drinkable item that belongs in this meal: base foods, toppings, mix-ins, yogurt/dairy, granola, seeds, nuts, oils, and powders that appear scooped into the meal (protein, creatine, collagen, sweeteners, etc.).
- Do NOT collapse labeled products into vague names like "powder", "powdered protein", or "mystery powder" when a label is readable — use the label (e.g. "creatine", "Greek yogurt (Hercules)").
- Do NOT skip background packages that match items in the bowl. If yogurt packaging is in the photo and yogurt could be in the meal, include yogurt (or note it only if clearly unused — default to including when the meal looks mixed/built from those packages).
- Estimate a realistic portion for each listed ingredient. Macros must sum from the full ingredient list (not a simplified subset).
- confidence should drop when labels are unreadable or portions are unclear — never invent products that are not in the photo.

Tasks:
1. If INVALID — set valid=false. Do NOT invent macros or ingredients. Write alex_message as a short sarcastic roast (1–3 sentences) calling out that this is not food. ${language} Roast the attempt, not their worth as a person. No cruel insults.
2. If VALID — set valid=true. alex_message can be omitted or empty. Perform a complete analysis using the rules above.

Respond with ONLY valid JSON (no markdown):
{
  "valid": true | false,
  "alex_message": "string (required when valid=false; empty when valid=true)",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "name": "short meal name",
  "description": "one sentence describing what you see, naming key labeled products",
  "confidence": number between 0 and 1,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "ingredients": [{ "name": "specific food or labeled product", "amount": "estimated portion e.g. 150g, 1 cup, 5g creatine" }]
}

When valid=false: set name to "", description to "", confidence to 0, all macros to 0, ingredients to [].
When valid=true: use whole numbers for macros. ingredients MUST be complete (every identifiable item). confidence should reflect image clarity, label readability, and portion certainty.`;
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

const MEAL_VISION_OPTIONS = {
  maxTokens: 1600,
  imageDetail: "high" as const,
};

export async function analyzeMealPhoto(
  imageBase64: string,
  mimeType: string,
  locale?: string | null
): Promise<MealAnalysisResult> {
  const raw = await runVisionPrompt(
    buildPhotoPrompt(locale),
    imageBase64,
    mimeType,
    MEAL_VISION_OPTIONS
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

Refine this estimate using the photo and the user's notes. Re-read package labels in the photo. The photo must still be food/drink — if it is not, set valid=false. Return a COMPLETE ingredient list again (not a shorter subset).`;
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
  const raw = await runVisionPrompt(
    prompt,
    imageBase64,
    mimeType,
    MEAL_VISION_OPTIONS
  );
  return parseMealAnalysis(raw);
}
