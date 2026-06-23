"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getDailyLog(clientId: string, date: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
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
  const supabase = await createClient();
  const existing = await getDailyLog(clientId, date);

  if (existing) {
    const { error } = await supabase
      .from("daily_logs")
      .update(updates)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("daily_logs").insert({
      client_id: clientId,
      date,
      water_ml: updates.water_ml ?? 0,
      calories: updates.calories ?? 0,
      protein: updates.protein ?? 0,
      carbs: updates.carbs ?? 0,
      fat: updates.fat ?? 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function addWater(clientId: string, date: string, amount: number) {
  const existing = await getDailyLog(clientId, date);
  const current = existing?.water_ml ?? 0;
  return upsertDailyLog(clientId, date, { water_ml: current + amount });
}
