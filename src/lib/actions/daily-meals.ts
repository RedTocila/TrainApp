"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import { upsertDailyLog } from "@/lib/actions/logs";
import { mealPayloadFromForm, sumMealMacros, type MealFormData } from "@/lib/meal-utils";
import { getMealSlotPhase, resolveMealSlotForLog } from "@/lib/meal-times";
import { mealTypeForSlot, type MealSlot } from "@/lib/meal-slots";
import { MEAL_COLUMNS } from "@/lib/db-selects";
import type { DailyMealLog, Meal, MealType } from "@/lib/types";

async function syncDailyMacros(clientId: string, date: string) {
  const meals = await getDailyMealLogs(clientId, date);
  const totals = sumMealMacros(meals);
  await upsertDailyLog(clientId, date, totals);
}

async function clearSlotLogIfExists(
  admin: SupabaseClient,
  clientId: string,
  date: string,
  slot: MealSlot
) {
  const existing = await getDailyMealLogForSlot(clientId, date, slot);
  if (existing) {
    await admin.from("daily_meal_logs").delete().eq("id", existing.id);
  }
}

async function insertMealLogWithSlot(
  admin: SupabaseClient,
  clientId: string,
  date: string,
  input: {
    meal_type: MealType;
    name: string;
    description?: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foods: { name: string; amount?: string }[];
    source_meal_id?: string | null;
    explicitSlot?: MealSlot | null;
  }
) {
  const existingLogs = await getDailyMealLogs(clientId, date);
  const slot =
    input.explicitSlot ??
    resolveMealSlotForLog(existingLogs, input.meal_type, date);

  if (slot) {
    await clearSlotLogIfExists(admin, clientId, date, slot);
  }

  const meal_type = slot ? mealTypeForSlot(slot) : input.meal_type;

  return admin.from("daily_meal_logs").insert({
    client_id: clientId,
    date,
    slot: slot ?? null,
    meal_type,
    name: input.name,
    description: input.description,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    foods: input.foods,
    source_meal_id: input.source_meal_id ?? null,
  });
}

export async function getDailyMealLogs(
  clientId: string,
  date: string
): Promise<DailyMealLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_meal_logs")
    .select(
      "id, client_id, date, slot, meal_type, name, description, calories, protein, carbs, fat, foods, source_meal_id, logged_at"
    )
    .eq("client_id", clientId)
    .eq("date", date)
    .order("logged_at");

  return (data ?? []) as DailyMealLog[];
}

export async function getDailyMealLogForSlot(
  clientId: string,
  date: string,
  slot: MealSlot
): Promise<DailyMealLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_meal_logs")
    .select(
      "id, client_id, date, slot, meal_type, name, description, calories, protein, carbs, fat, foods, source_meal_id, logged_at"
    )
    .eq("client_id", clientId)
    .eq("date", date)
    .eq("slot", slot)
    .maybeSingle();

  return (data as DailyMealLog | null) ?? null;
}

export async function logPlannedMealOption(
  clientId: string,
  date: string,
  slot: MealSlot,
  plannedMeal: Meal
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };
  const { admin } = mutation;

  const existing = await getDailyMealLogForSlot(clientId, date, slot);

  if (existing && existing.source_meal_id === plannedMeal.id) {
    return { success: true, checked: true };
  }

  if (!existing && getMealSlotPhase(slot, date) === "missed") {
    return { error: "This meal window has passed — you can no longer log it" };
  }

  if (existing) {
    await admin.from("daily_meal_logs").delete().eq("id", existing.id);
  }

  const { error } = await admin.from("daily_meal_logs").insert({
    client_id: clientId,
    date,
    slot,
    meal_type: plannedMeal.meal_type,
    name: plannedMeal.name,
    description: plannedMeal.description,
    calories: plannedMeal.calories ?? 0,
    protein: plannedMeal.protein ?? 0,
    carbs: plannedMeal.carbs ?? 0,
    fat: plannedMeal.fat ?? 0,
    foods: plannedMeal.foods ?? [],
    source_meal_id: plannedMeal.id,
  });

  if (error) return { error: formatDbError(error.message) };

  await syncDailyMacros(clientId, date);
  return { success: true, checked: true };
}

export async function togglePlannedMealSlot(
  clientId: string,
  date: string,
  slot: MealSlot,
  plannedMeal: Meal
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };
  const { admin } = mutation;

  const existing = await getDailyMealLogForSlot(clientId, date, slot);

  if (existing) {
    const { error } = await admin
      .from("daily_meal_logs")
      .delete()
      .eq("id", existing.id)
      .eq("client_id", clientId)
      .eq("date", date);

    if (error) return { error: formatDbError(error.message) };
    await syncDailyMacros(clientId, date);
    return { success: true, checked: false };
  }

  if (getMealSlotPhase(slot, date) === "missed") {
    return { error: "This meal window has passed — you can no longer log it" };
  }

  const macros = {
    calories: plannedMeal.calories ?? 0,
    protein: plannedMeal.protein ?? 0,
    carbs: plannedMeal.carbs ?? 0,
    fat: plannedMeal.fat ?? 0,
  };

  const { error } = await admin.from("daily_meal_logs").insert({
    client_id: clientId,
    date,
    slot,
    meal_type: plannedMeal.meal_type,
    name: plannedMeal.name,
    description: plannedMeal.description,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    foods: plannedMeal.foods ?? [],
    source_meal_id: plannedMeal.id,
  });

  if (error) return { error: formatDbError(error.message) };

  await syncDailyMacros(clientId, date);
  return { success: true, checked: true };
}

export async function logMealFromLibrary(
  clientId: string,
  date: string,
  mealId: string
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };
  const { admin } = mutation;

  const { data: meal } = await admin.from("meals").select(MEAL_COLUMNS).eq("id", mealId).single();
  if (!meal) return { error: "Meal not found" };

  const { data: plan } = await admin
    .from("nutrition_plans")
    .select("id")
    .eq("id", meal.plan_id)
    .eq("created_by", mutation.userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Meal not found" };

  const { error } = await insertMealLogWithSlot(admin, clientId, date, {
    meal_type: meal.meal_type,
    name: meal.name,
    description: meal.description,
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    foods: meal.foods ?? [],
    source_meal_id: meal.id,
  });

  if (error) return { error: formatDbError(error.message) };

  await syncDailyMacros(clientId, date);
  return { success: true };
}

export async function logCustomMeal(clientId: string, date: string, data: MealFormData) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };
  const { admin } = mutation;

  const payload = mealPayloadFromForm(data);
  if (!payload.name) return { error: "Meal name is required" };

  const { error } = await insertMealLogWithSlot(admin, clientId, date, {
    meal_type: payload.meal_type,
    name: payload.name,
    description: payload.description,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    foods: payload.foods,
  });

  if (error) return { error: formatDbError(error.message) };

  await syncDailyMacros(clientId, date);
  return { success: true };
}

export async function deleteDailyMealLog(clientId: string, date: string, logId: string) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const { error } = await mutation.admin
    .from("daily_meal_logs")
    .delete()
    .eq("id", logId)
    .eq("client_id", clientId)
    .eq("date", date);

  if (error) return { error: formatDbError(error.message) };

  await syncDailyMacros(clientId, date);
  return { success: true };
}
