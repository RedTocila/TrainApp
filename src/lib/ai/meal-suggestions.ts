import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";

function fallbackSuggestions(gap: MacroGap): MealSuggestion[] {
  const suggestions: MealSuggestion[] = [];
  if (gap.protein > 15) {
    suggestions.push({
      title: "High-protein boost",
      description: "Greek yogurt, chicken breast, tuna, cottage cheese, or a protein shake.",
      protein_g: Math.min(gap.protein, 40),
      calories: Math.min(gap.calories, 350),
      reason: `You need about ${Math.round(gap.protein)}g more protein today.`,
    });
  }
  if (gap.calories > 200 && suggestions.length < 3) {
    suggestions.push({
      title: "Balanced snack",
      description: "Rice with lean protein and vegetables, or oats with fruit and nuts.",
      protein_g: Math.min(gap.protein, 25),
      calories: Math.min(gap.calories, 450),
      reason: `You have ~${Math.round(gap.calories)} calories left.`,
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      title: "On track",
      description: "You're close to your targets. A light protein-rich snack if hungry.",
      protein_g: 0,
      calories: 0,
      reason: "Macros are nearly met for today.",
    });
  }
  return suggestions;
}

export async function generateMealSuggestions(gap: MacroGap): Promise<{
  headline: string;
  suggestions: MealSuggestion[];
}> {
  const prompt = `You are a fitness nutrition coach. Based on remaining macros, suggest 3 practical meals/snacks.

Remaining today:
- Calories: ${Math.round(gap.calories)} kcal
- Protein: ${Math.round(gap.protein)}g
- Carbs: ${Math.round(gap.carbs)}g
- Fat: ${Math.round(gap.fat)}g

Targets: ${gap.targets.calories} kcal, ${gap.targets.protein}g protein.
Prioritize protein if protein gap is largest.

Respond with ONLY valid JSON:
{
  "headline": "one motivating sentence e.g. You need 40g more protein today.",
  "suggestions": [
    {
      "title": "meal name",
      "description": "specific foods and portions",
      "protein_g": number,
      "calories": number,
      "reason": "why this fits remaining macros"
    }
  ]
}`;

  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 900, json: true });
    const parsed = parseJsonObject<{
      headline?: string;
      suggestions?: MealSuggestion[];
    }>(raw);
    const suggestions = (parsed.suggestions ?? []).slice(0, 4);
    if (suggestions.length === 0) {
      return { headline: parsed.headline ?? "Meal ideas for your remaining macros", suggestions: fallbackSuggestions(gap) };
    }
    return {
      headline: parsed.headline ?? "Meal ideas for your remaining macros",
      suggestions,
    };
  } catch {
    return {
      headline:
        gap.protein > 20
          ? `You need about ${Math.round(gap.protein)}g more protein today.`
          : "Meal ideas for your remaining macros",
      suggestions: fallbackSuggestions(gap),
    };
  }
}
