"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyMealSlotSchedule, clearAllClientNutritionSchedule } from "@/lib/actions/meal-slot-schedule";
import type { Meal, NutritionScheduleConfig } from "@/lib/types";

export { clearAllClientNutritionSchedule };

export async function scheduleNutritionForClient(
  clientId: string,
  planId: string,
  config: NutritionScheduleConfig,
  meals?: Meal[]
) {
  return applyMealSlotSchedule(clientId, planId, config, meals);
}

export async function clearClientNutritionScheduleForPlan(
  clientId: string,
  planId: string
) {
  const admin = createAdminClient();
  await admin
    .from("scheduled_nutrition_days")
    .delete()
    .eq("client_id", clientId)
    .eq("plan_id", planId);
  await admin
    .from("scheduled_meal_slots")
    .delete()
    .eq("client_id", clientId)
    .eq("plan_id", planId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
}
