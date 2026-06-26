import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { formatExceededMacroSummary } from "@/lib/macro-targets";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";

function fallbackReductionAdvice(gap: MacroGap): MealSuggestion[] {
  const summary = formatExceededMacroSummary(gap.consumed, gap.targets);
  const suggestions: MealSuggestion[] = [
    {
      title: "Review today's meals",
      description:
        "Check which meals pushed you over — often snacks, sauces, oils, or larger portions than planned.",
      protein_g: 0,
      calories: 0,
      reason: `You're above your macro ceiling (${summary}).`,
    },
    {
      title: "Plan lighter tomorrow",
      description:
        "Smaller portions, lean protein, more vegetables, and fewer calorie-dense add-ons (cheese, oils, sweets).",
      protein_g: 0,
      calories: 0,
      reason: "Bring totals back inside your tolerance band.",
    },
  ];

  if (gap.surplus.calories > 0) {
    suggestions.push({
      title: "Trim calories first",
      description:
        "Cut ~200–400 kcal tomorrow via smaller starch portions, fewer drinks, and lighter cooking fats.",
      protein_g: 0,
      calories: gap.surplus.calories,
      reason: `You're ~${gap.surplus.calories} kcal above your calorie ceiling.`,
    });
  }

  return suggestions.slice(0, 3);
}

function fallbackSuggestions(gap: MacroGap): MealSuggestion[] {
  if (gap.overTolerance) {
    return fallbackReductionAdvice(gap);
  }

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
  if (gap.overTolerance) {
    const summary = formatExceededMacroSummary(gap.consumed, gap.targets);
    const headline = `You went over your macro limit (${summary}). Eat less tomorrow — review today's meals.`;

    const prompt = `You are a fitness nutrition coach. The client EXCEEDED their daily macro tolerance — do NOT suggest more food today.

Over the limit:
- Calories: +${gap.surplus.calories} kcal above ceiling
- Protein: +${gap.surplus.protein}g above ceiling
- Carbs: +${gap.surplus.carbs}g above ceiling
- Fat: +${gap.surplus.fat}g above ceiling

Consumed: ${gap.consumed.calories} kcal, ${gap.consumed.protein}g protein.
Targets: ${gap.targets.calories} kcal, ${gap.targets.protein}g protein.

Suggest 3 practical ways to correct course: review today's logs, lighter meals tomorrow, portion swaps. No "eat more" advice.

Respond with ONLY valid JSON:
{
  "headline": "one direct sentence about being over limit and eating less tomorrow",
  "suggestions": [
    {
      "title": "action title",
      "description": "specific portion or meal adjustments",
      "protein_g": 0,
      "calories": 0,
      "reason": "why this helps after overshooting"
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
        return { headline, suggestions: fallbackReductionAdvice(gap) };
      }
      return {
        headline: parsed.headline ?? headline,
        suggestions,
      };
    } catch {
      return { headline, suggestions: fallbackReductionAdvice(gap) };
    }
  }

  const prompt = `You are a fitness nutrition coach. Based on remaining macros, suggest 3 practical meals/snacks.

Remaining today (room left before upper tolerance):
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
