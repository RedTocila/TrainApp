"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BodyWeightLog } from "@/lib/types";

export async function getBodyWeightLog(
  clientId: string,
  date: string
): Promise<BodyWeightLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("body_weight_logs")
    .select("*")
    .eq("client_id", clientId)
    .eq("date", date)
    .maybeSingle();
  return data;
}

export async function getBodyWeightHistory(
  clientId: string,
  days = 90
): Promise<BodyWeightLog[]> {
  const supabase = await createClient();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromKey = from.toISOString().split("T")[0];

  const { data } = await supabase
    .from("body_weight_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("date", fromKey)
    .order("date", { ascending: true });

  return data ?? [];
}

export async function upsertBodyWeightLog(
  clientId: string,
  date: string,
  weightKg: number
) {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg >= 500) {
    return { error: "Enter a valid weight between 0 and 500 kg" };
  }

  const supabase = await createClient();
  const existing = await getBodyWeightLog(clientId, date);

  if (existing) {
    const { error } = await supabase
      .from("body_weight_logs")
      .update({ weight_kg: weightKg })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("body_weight_logs").insert({
      client_id: clientId,
      date,
      weight_kg: weightKg,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBodyWeightLog(clientId: string, date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("body_weight_logs")
    .delete()
    .eq("client_id", clientId)
    .eq("date", date);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
