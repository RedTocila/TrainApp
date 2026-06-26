"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireOwnedClient,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import { CLIENT_DAY_TASK_COLUMNS } from "@/lib/db-selects";
import type { ClientDayTask } from "@/lib/types";

export async function getDayTasksInRange(
  clientId: string,
  from: string,
  to: string
): Promise<ClientDayTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_day_tasks")
    .select(CLIENT_DAY_TASK_COLUMNS)
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
    .select(CLIENT_DAY_TASK_COLUMNS)
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

  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const { admin } = mutation;
  const { data: last } = await admin
    .from("client_day_tasks")
    .select("order_index")
    .eq("client_id", clientId)
    .eq("date", date)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { data, error } = await admin
    .from("client_day_tasks")
    .insert({
      client_id: clientId,
      date,
      title: trimmed,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) return { error: formatDbError(error.message) };
  revalidatePath("/dashboard");
  return { data: data as ClientDayTask };
}

export async function toggleDayTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const auth = await requireOwnedClient(user.id);
  if ("error" in auth) return { error: auth.error };

  const { data: task } = await auth.admin
    .from("client_day_tasks")
    .select("id, completed, client_id")
    .eq("id", taskId)
    .eq("client_id", user.id)
    .single();

  if (!task) return { error: "Task not found" };

  const { data, error } = await auth.admin
    .from("client_day_tasks")
    .update({ completed: !task.completed })
    .eq("id", taskId)
    .select()
    .single();

  if (error) return { error: formatDbError(error.message) };
  revalidatePath("/dashboard");
  return { data: data as ClientDayTask };
}

export async function deleteDayTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const auth = await requireOwnedClient(user.id);
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.admin
    .from("client_day_tasks")
    .delete()
    .eq("id", taskId)
    .eq("client_id", user.id);

  if (error) return { error: formatDbError(error.message) };
  revalidatePath("/dashboard");
  return { success: true };
}
