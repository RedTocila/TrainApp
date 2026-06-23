import type { Meal, MealType } from "@/lib/types";
import { normalizeMealMacros, type MealMacros } from "@/lib/meal-utils";

export type MealSlot = "breakfast" | "snack_1" | "lunch" | "snack_2" | "dinner";

export const MEAL_SLOTS: {
  slot: MealSlot;
  label: string;
  meal_type: MealType;
}[] = [
  { slot: "breakfast", label: "Breakfast", meal_type: "breakfast" },
  { slot: "snack_1", label: "Snack 1", meal_type: "snack" },
  { slot: "lunch", label: "Lunch", meal_type: "lunch" },
  { slot: "snack_2", label: "Snack 2", meal_type: "snack" },
  { slot: "dinner", label: "Dinner", meal_type: "dinner" },
];

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((s) => s.slot === slot)?.label ?? slot;
}

export function mealTypeForSlot(slot: MealSlot): MealType {
  return MEAL_SLOTS.find((s) => s.slot === slot)!.meal_type;
}

export function groupMealsBySlot(meals: Meal[]): Record<MealSlot, Meal[]> {
  const grouped = Object.fromEntries(
    MEAL_SLOTS.map((s) => [s.slot, [] as Meal[]])
  ) as Record<MealSlot, Meal[]>;

  for (const meal of meals) {
    const slot = (meal.slot as MealSlot | null) ?? inferSlotFromLegacyMeal(meal, meals);
    if (slot) grouped[slot].push(meal);
  }

  for (const slot of MEAL_SLOTS) {
    grouped[slot.slot].sort((a, b) => a.order_index - b.order_index);
  }

  return grouped;
}

function inferSlotFromLegacyMeal(meal: Meal, allMeals: Meal[]): MealSlot | null {
  if (meal.meal_type === "breakfast") return "breakfast";
  if (meal.meal_type === "lunch") return "lunch";
  if (meal.meal_type === "dinner") return "dinner";
  if (meal.meal_type === "snack") {
    const snacks = allMeals
      .filter((m) => m.meal_type === "snack")
      .sort((a, b) => a.order_index - b.order_index);
    const idx = snacks.findIndex((m) => m.id === meal.id);
    return idx <= 0 ? "snack_1" : "snack_2";
  }
  return null;
}

export function getPrimaryMealsForDayMenu(meals: Meal[]): Meal[] {
  const grouped = groupMealsBySlot(meals);
  return MEAL_SLOTS.map((s) => grouped[s.slot][0]).filter(Boolean) as Meal[];
}

export function sumDayMenuMacros(meals: Meal[]): MealMacros {
  const primary = getPrimaryMealsForDayMenu(meals);
  return primary.reduce(
    (acc, meal) => {
      const m = normalizeMealMacros(meal);
      return {
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function formatSlotSummary(meals: Meal[]): string {
  const grouped = groupMealsBySlot(meals);
  return MEAL_SLOTS.map((s) => {
    const count = grouped[s.slot].length;
    if (count === 0) return null;
    const abbrev =
      s.slot === "breakfast"
        ? "B"
        : s.slot === "lunch"
          ? "L"
          : s.slot === "dinner"
            ? "D"
            : "S";
    return count > 1 ? `${abbrev}×${count}` : abbrev;
  })
    .filter(Boolean)
    .join(" · ");
}
