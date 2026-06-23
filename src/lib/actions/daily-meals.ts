"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { upsertDailyLog } from "@/lib/actions/logs";
import { mealPayloadFromForm, sumMealMacros, type MealFormData } from "@/lib/meal-utils";
import type { MealSlot } from "@/lib/meal-slots";
import type { DailyMealLog, Meal } from "@/lib/types";

async function syncDailyMacros(clientId: string, date: string) {
  const meals = await getDailyMealLogs(clientId, date);
  const totals = sumMealMacros(meals);
  await upsertDailyLog(clientId, date, totals);
}

export async function getDailyMealLogs(
  clientId: string,
  date: string
): Promise<DailyMealLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_meal_logs")
    .select("*")
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
    .select("*")
    .eq("client_id", clientId)
    .eq("date", date)
    .eq("slot", slot)
    .maybeSingle();

  return (data as DailyMealLog | null) ?? null;
}

export async function togglePlannedMealSlot(
  clientId: string,
  date: string,
  slot: MealSlot,
  plannedMeal: Meal
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== clientId) return { error: "Not authenticated" };

  const existing = await getDailyMealLogForSlot(clientId, date, slot);

  if (existing) {
    const { error } = await supabase
      .from("daily_meal_logs")
      .delete()
      .eq("id", existing.id)
      .eq("client_id", clientId)
      .eq("date", date);

    if (error) return { error: error.message };
    await syncDailyMacros(clientId, date);
    revalidatePath("/dashboard");
    return { success: true, checked: false };
  }

  const { error } = await supabase.from("daily_meal_logs").insert({
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

  if (error) return { error: error.message };

  await syncDailyMacros(clientId, date);
  revalidatePath("/dashboard");
  return { success: true, checked: true };
}

export async function logMealFromLibrary(
  clientId: string,
  date: string,
  mealId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== clientId) return { error: "Not authenticated" };

  const { data: meal } = await supabase.from("meals").select("*").eq("id", mealId).single();
  if (!meal) return { error: "Meal not found" };

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("id", meal.plan_id)
    .eq("created_by", user.id)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Meal not found" };

  const { error } = await supabase.from("daily_meal_logs").insert({
    client_id: clientId,
    date,
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

  if (error) return { error: error.message };

  await syncDailyMacros(clientId, date);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function logCustomMeal(clientId: string, date: string, data: MealFormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== clientId) return { error: "Not authenticated" };

  const payload = mealPayloadFromForm(data);
  if (!payload.name) return { error: "Meal name is required" };

  const { error } = await supabase.from("daily_meal_logs").insert({
    client_id: clientId,
    date,
    meal_type: payload.meal_type,
    name: payload.name,
    description: payload.description,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    foods: payload.foods,
  });

  if (error) return { error: error.message };

  await syncDailyMacros(clientId, date);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteDailyMealLog(clientId: string, date: string, logId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== clientId) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("daily_meal_logs")
    .delete()
    .eq("id", logId)
    .eq("client_id", clientId)
    .eq("date", date);

  if (error) return { error: error.message };

  await syncDailyMacros(clientId, date);
  revalidatePath("/dashboard");
  return { success: true };
}
