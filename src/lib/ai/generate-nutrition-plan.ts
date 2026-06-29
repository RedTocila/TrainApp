import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import type { AiGeneratedNutritionPlan, AiNutritionMeal } from "@/lib/ai/plan-builder-types";
import type { Profile } from "@/lib/types";
import type { MealSlot } from "@/lib/meal-slots";
import { normalizeGroceryList } from "@/lib/grocery-list-utils";

const VALID_SLOTS = new Set<MealSlot>([
  "breakfast",
  "snack_1",
  "lunch",
  "snack_2",
  "dinner",
]);

function roundMacro(n: unknown): number {
  const v = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function normalizeNutritionPlan(raw: AiGeneratedNutritionPlan): AiGeneratedNutritionPlan {
  const meals = (raw.meals ?? [])
    .filter((m) => m.name?.trim() && VALID_SLOTS.has(m.slot))
    .map((meal) => ({
      slot: meal.slot,
      name: meal.name.trim(),
      description: meal.description?.trim() || "",
      calories: roundMacro(meal.calories),
      protein: roundMacro(meal.protein),
      carbs: roundMacro(meal.carbs),
      fat: roundMacro(meal.fat),
      ingredients: (meal.ingredients ?? [])
        .filter((i) => i.name?.trim())
        .map((i) => ({
          name: i.name.trim(),
          amount: i.amount?.trim() || undefined,
        })),
    }));

  const targets = {
    calories: roundMacro(raw.daily_targets?.calories) || 2000,
    protein: roundMacro(raw.daily_targets?.protein) || 150,
    carbs: roundMacro(raw.daily_targets?.carbs) || 200,
    fat: roundMacro(raw.daily_targets?.fat) || 65,
  };

  return {
    title: raw.title?.trim() || "AI Nutrition Plan",
    description: raw.description?.trim() || "",
    daily_targets: targets,
    meals: meals.length > 0 ? meals : defaultMeals(targets),
    coach_notes: (raw.coach_notes ?? []).filter((n) => n?.trim()).map((n) => n.trim()),
    grocery_list: normalizeGroceryList(raw.grocery_list).map((item) => ({
      name: item.name,
      amount: item.amount,
      category: item.category,
    })),
  };
}

function defaultMeals(targets: AiGeneratedNutritionPlan["daily_targets"]): AiNutritionMeal[] {
  const p = Math.round(targets.protein / 5);
  const c = Math.round(targets.carbs / 5);
  const f = Math.round(targets.fat / 5);
  const cal = Math.round(targets.calories / 5);

  return [
    { slot: "breakfast", name: "Balanced breakfast", calories: cal, protein: p, carbs: c, fat: f },
    { slot: "snack_1", name: "Protein snack", calories: Math.round(cal * 0.6), protein: p, carbs: Math.round(c * 0.5), fat: Math.round(f * 0.5) },
    { slot: "lunch", name: "Lean lunch", calories: cal, protein: p, carbs: c, fat: f },
    { slot: "snack_2", name: "Afternoon snack", calories: Math.round(cal * 0.6), protein: p, carbs: Math.round(c * 0.5), fat: Math.round(f * 0.5) },
    { slot: "dinner", name: "Balanced dinner", calories: cal, protein: p, carbs: c, fat: f },
  ];
}

export async function generateNutritionPlanFromProfile(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedNutritionPlan> {
  const intake = buildIntakeContextForAi(profile, preferences);

  const prompt = `You are an expert sports nutritionist. Create a full-day meal plan with macro targets for this client.

CLIENT PROFILE:
${intake}

Rules:
- Calculate realistic daily calories and macros from age, gender, weight, height, goal, and activity (use work schedule & daily routine as activity hints).
- Provide exactly one primary meal per slot: breakfast, snack_1, lunch, snack_2, dinner.
- Meal macros should sum close to daily_targets (within ~10%).
- Use simple, whole-food meals with realistic portions.
- Respect medical conditions and injuries where relevant to food choices.
- Include 2-5 ingredients per meal when helpful.
- Add a weekly grocery_list with realistic total amounts for 7 days (merge duplicates, group by category).

Respond with ONLY valid JSON:
{
  "title": "short plan name",
  "description": "1-2 sentences explaining the approach",
  "daily_targets": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "meals": [
    {
      "slot": "breakfast" | "snack_1" | "lunch" | "snack_2" | "dinner",
      "name": "meal name",
      "description": "short description",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "ingredients": [{ "name": "food", "amount": "e.g. 150g" }]
    }
  ],
  "grocery_list": [
    { "name": "ingredient", "amount": "weekly amount e.g. 1.2 kg", "category": "Protein" | "Produce" | "Dairy" | "Pantry" | "Other" }
  ],
  "coach_notes": ["2-4 practical nutrition tips"]
}`;

  const raw = await runTextPrompt(prompt, { maxTokens: 2800, json: true });
  const parsed = parseJsonObject(raw) as unknown as AiGeneratedNutritionPlan;
  return normalizeNutritionPlan(parsed);
}
