import type { ClientSchedule } from "@/lib/daily-tasks";
import type { Meal, MealSlot } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";

export function nutritionPlanFromSchedule(
  date: Date,
  schedule: ClientSchedule
): {
  title: string;
  meals: Meal[];
  scheduled?: boolean;
  activeSlots?: MealSlot[];
  kind?: "personal" | "ai";
  planId?: string;
} | null {
  const dateKey = formatDateKey(date);
  const scheduled = schedule.scheduledNutritionDays?.find(
    (entry) => entry.scheduled_date === dateKey
  );
  if (!scheduled) return null;
  const plan = scheduled.nutrition_plans;
  const meals = plan?.meals ?? [];
  if (meals.length === 0) return null;

  return {
    title: plan?.title ?? "Meal plan",
    meals: [...meals].sort((a, b) => a.order_index - b.order_index),
    scheduled: true,
    kind: plan?.is_personal ? "personal" : undefined,
    planId: scheduled.plan_id,
  };
}
