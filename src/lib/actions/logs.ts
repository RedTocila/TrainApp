"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import { updatePersonalNutritionPlanMacros } from "@/lib/actions/user-nutrition";

export async function getDailyLog(clientId: string, date: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_logs")
    .select("id, client_id, date, water_ml, calories, protein, carbs, fat")
    .eq("client_id", clientId)
    .eq("date", date)
    .maybeSingle();
  return data;
}

export async function upsertDailyLog(
  clientId: string,
  date: string,
  updates: Partial<{
    water_ml: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const { admin } = mutation;
  const existing = await getDailyLog(clientId, date);

  if (existing) {
    const { error } = await admin
      .from("daily_logs")
      .update(updates)
      .eq("id", existing.id);
    if (error) return { error: formatDbError(error.message) };
  } else {
    const { error } = await admin.from("daily_logs").insert({
      client_id: clientId,
      date,
      water_ml: updates.water_ml ?? 0,
      calories: updates.calories ?? 0,
      protein: updates.protein ?? 0,
      carbs: updates.carbs ?? 0,
      fat: updates.fat ?? 0,
    });
    if (error) return { error: formatDbError(error.message) };
  }

  return { success: true };
}

export async function addWater(clientId: string, date: string, amount: number) {
  const existing = await getDailyLog(clientId, date);
  const current = existing?.water_ml ?? 0;
  return upsertDailyLog(clientId, date, { water_ml: current + amount });
}

export async function setWater(clientId: string, date: string, waterMl: number) {
  if (!Number.isFinite(waterMl) || waterMl < 0 || waterMl > 15000) {
    return { error: "Water intake must be between 0 and 15000 ml" };
  }
  return upsertDailyLog(clientId, date, { water_ml: Math.round(waterMl) });
}

export async function getWaterGoal(clientId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("water_goal_ml")
    .eq("id", clientId)
    .single();

  return data?.water_goal_ml ?? 2500;
}

export async function updateWaterGoal(clientId: string, waterGoalMl: number) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  if (!Number.isFinite(waterGoalMl) || waterGoalMl < 500 || waterGoalMl > 10000) {
    return { error: "Water goal must be between 500 and 10000 ml" };
  }

  const { error } = await mutation.admin
    .from("profiles")
    .update({ water_goal_ml: Math.round(waterGoalMl) })
    .eq("id", clientId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateNutritionTargets(
  clientId: string,
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
  options?: { personalPlanId?: string | null }
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const calories = Math.round(targets.calories);
  const protein = Math.round(targets.protein);
  const carbs = Math.round(targets.carbs);
  const fat = Math.round(targets.fat);

  if (!Number.isFinite(calories) || calories < 500 || calories > 10000) {
    return { error: "Calories must be between 500 and 10000" };
  }
  if (!Number.isFinite(protein) || protein < 0 || protein > 1000) {
    return { error: "Protein must be between 0 and 1000 g" };
  }
  if (!Number.isFinite(carbs) || carbs < 0 || carbs > 2000) {
    return { error: "Carbs must be between 0 and 2000 g" };
  }
  if (!Number.isFinite(fat) || fat < 0 || fat > 500) {
    return { error: "Fat must be between 0 and 500 g" };
  }

  if (options?.personalPlanId) {
    const result = await updatePersonalNutritionPlanMacros(options.personalPlanId, {
      target_calories: calories,
      target_protein: protein,
      target_carbs: carbs,
      target_fat: fat,
    });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard");
    return { success: true };
  }

  const { error } = await mutation.admin
    .from("profiles")
    .update({
      target_calories: calories,
      target_protein: protein,
      target_carbs: carbs,
      target_fat: fat,
    })
    .eq("id", clientId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
