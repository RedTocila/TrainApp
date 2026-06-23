"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientDayTask } from "@/lib/types";

export async function getDayTasksInRange(
  clientId: string,
  from: string,
  to: string
): Promise<ClientDayTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_day_tasks")
    .select("*")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("order_index");

  return data ?? [];
}

export async function getDayTasksForDate(
  clientId: string,
  date: string
): Promise<ClientDayTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_day_tasks")
    .select("*")
    .eq("client_id", clientId)
    .eq("date", date)
    .order("order_index");

  return data ?? [];
}

export async function createDayTask(
  clientId: string,
  date: string,
  title: string
) {
  const trimmed = title.trim();
  if (!trimmed) return { error: "Task title is required" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("client_day_tasks")
    .select("order_index")
    .eq("client_id", clientId)
    .eq("date", date)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { data, error } = await supabase
    .from("client_day_tasks")
    .insert({
      client_id: clientId,
      date,
      title: trimmed,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { data: data as ClientDayTask };
}

export async function toggleDayTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: task } = await supabase
    .from("client_day_tasks")
    .select("id, completed, client_id")
    .eq("id", taskId)
    .eq("client_id", user.id)
    .single();

  if (!task) return { error: "Task not found" };

  const { data, error } = await supabase
    .from("client_day_tasks")
    .update({ completed: !task.completed })
    .eq("id", taskId)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { data: data as ClientDayTask };
}

export async function deleteDayTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("client_day_tasks")
    .delete()
    .eq("id", taskId)
    .eq("client_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
