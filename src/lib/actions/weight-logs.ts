"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import type { BodyWeightLog } from "@/lib/types";

export async function getBodyWeightLog(
  clientId: string,
  date: string
): Promise<BodyWeightLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("body_weight_logs")
    .select("id, client_id, date, weight_kg, created_at")
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
    .select("id, client_id, date, weight_kg, created_at")
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
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg >= 500) {
    return { error: "Enter a valid weight between 0 and 500 kg" };
  }

  const { data, error } = await mutation.admin
    .from("body_weight_logs")
    .upsert(
      { client_id: clientId, date, weight_kg: weightKg },
      { onConflict: "client_id,date" }
    )
    .select("id, client_id, date, weight_kg, created_at")
    .single();
  if (error || !data) {
    return { error: formatDbError(error?.message ?? "Could not save weight") };
  }

  after(() => revalidatePath("/dashboard"));
  return { success: true as const, log: data as BodyWeightLog };
}

export async function deleteBodyWeightLog(clientId: string, date: string) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const { error } = await mutation.admin
    .from("body_weight_logs")
    .delete()
    .eq("client_id", clientId)
    .eq("date", date);

  if (error) return { error: formatDbError(error.message) };
  after(() => revalidatePath("/dashboard"));
  return { success: true };
}
