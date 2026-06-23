import { generateRecurringScheduleDates } from "@/lib/schedule-utils";
import { MEAL_SLOTS, groupMealsBySlot, type MealSlot } from "@/lib/meal-slots";
import type { Meal, NutritionScheduleConfig, SlotScheduleConfig } from "@/lib/types";

export function buildSlotScheduleDates(config: SlotScheduleConfig): string[] {
  if (!config.enabled || config.weekdays.length === 0) return [];

  const recurring = generateRecurringScheduleDates(
    new Date(config.startDate + "T12:00:00"),
    config.weekdays,
    config.weeks
  );

  const extra = config.extraDates ?? [];
  return [...new Set([...recurring, ...extra])].sort();
}

/** @deprecated legacy whole-plan dates */
export function buildNutritionScheduleDates(config: NutritionScheduleConfig): string[] {
  if (config.startDate && config.weekdays && config.weeks) {
    const recurring = generateRecurringScheduleDates(
      new Date(config.startDate + "T12:00:00"),
      config.weekdays,
      config.weeks
    );
    const extra = config.extraDates ?? [];
    return [...new Set([...recurring, ...extra])].sort();
  }
  return [];
}

export function buildPerSlotScheduleDates(
  config: NutritionScheduleConfig
): Partial<Record<MealSlot, string[]>> {
  const result: Partial<Record<MealSlot, string[]>> = {};

  if (config.slots && Object.keys(config.slots).length > 0) {
    for (const [slot, slotConfig] of Object.entries(config.slots) as [
      MealSlot,
      SlotScheduleConfig,
    ][]) {
      if (slotConfig?.enabled) {
        result[slot] = buildSlotScheduleDates(slotConfig);
      }
    }
    return result;
  }

  const legacyDates = buildNutritionScheduleDates(config);
  if (legacyDates.length === 0) return result;

  for (const { slot } of MEAL_SLOTS) {
    result[slot] = legacyDates;
  }
  return result;
}

export function slotsWithMealsFromPlan(meals: Meal[]): MealSlot[] {
  const grouped = groupMealsBySlot(meals);
  return MEAL_SLOTS.filter(({ slot }) => grouped[slot].length > 0).map((s) => s.slot);
}

export function normalizeScheduleConfigForPlan(
  config: NutritionScheduleConfig,
  meals: Meal[],
  defaultStartDate: string
): Partial<Record<MealSlot, SlotScheduleConfig>> {
  if (config.slots && Object.keys(config.slots).length > 0) {
    return config.slots;
  }

  const slotsWithMeals = slotsWithMealsFromPlan(meals);
  const weekdays = config.weekdays ?? [1, 2, 3, 4, 5];
  const weeks = config.weeks ?? 4;
  const startDate = config.startDate ?? defaultStartDate;
  const extraDates = config.extraDates;

  const slots: Partial<Record<MealSlot, SlotScheduleConfig>> = {};
  for (const slot of slotsWithMeals) {
    slots[slot] = {
      enabled: true,
      startDate,
      weekdays,
      weeks,
      extraDates,
    };
  }
  return slots;
}
