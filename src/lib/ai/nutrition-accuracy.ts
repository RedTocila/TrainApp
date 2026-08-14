import type { DailyMealLog } from "@/lib/types";

/** Shared nutrition accuracy rules for Coach Alex and related prompts. */
export const NUTRITION_ACCURACY_RULES = `ACCURACY FIRST (correct facts; sarcastic delivery is how you say them):
- Never invent macros, meal names, portions, or food facts. If unsure, ask one clarifying question.
- TODAY'S MACRO CHECK and TODAY'S LOGGED MEALS (when provided) are ground truth. Do not contradict them.
- Never say a macro is low/under when it is at or over target. Never say it is high/over when it is under target.
- Quote logged meal names EXACTLY as written — never translate, "correct", shorten, or rewrite them.
- Match food suggestions to the macro you want to move:
  - Protein: chicken, turkey, fish/tuna, eggs, Greek yogurt, cottage cheese, lean meat, protein shake. NOT nuts, nut butters, seeds, avocado, oils, or cheese as the main protein fix (those are fat-heavy).
  - Fat: nuts/arrat, peanut butter, oils, fatty cuts — only when fat is actually under target and calories allow.
  - Carbs: rice, oats, bread, fruit, potatoes — not as a protein solution.
- If fat is already at or over target, do not recommend nuts, oils, or other calorie-dense fats — unless calories are also under target and the goal is gain_weight / build_muscle.
- If calories are under target (especially gain_weight), calorie-dense foods ARE appropriate: extra rice/oats/pasta, nut butters, olive oil, dairy, smoothies, extra snacks — fill the actual under-target macros.
- Prefer advice tied to their actual logged meals and numbers over generic textbook tips.
- Do NOT write a dry factual paragraph and then bolt a joke on at the end. Weave sarcasm into the whole reply while the numbers stay correct.`;

export function formatTodaysLoggedMeals(
  meals: Array<
    Pick<
      DailyMealLog,
      "name" | "meal_type" | "calories" | "protein" | "carbs" | "fat" | "foods"
    >
  >
): string {
  if (meals.length === 0) {
    return "  (none logged yet today)";
  }

  return meals
    .map((meal, index) => {
      const foods = (meal.foods ?? [])
        .map((f) => (f.amount ? `${f.name} (${f.amount})` : f.name))
        .filter(Boolean)
        .join(", ");
      const foodsPart = foods ? ` | foods: ${foods}` : "";
      return `  ${index + 1}. "${meal.name}" (${meal.meal_type}) — ${Math.round(meal.calories ?? 0)} kcal, P${Math.round(meal.protein ?? 0)}g C${Math.round(meal.carbs ?? 0)}g F${Math.round(meal.fat ?? 0)}g${foodsPart}`;
    })
    .join("\n");
}
