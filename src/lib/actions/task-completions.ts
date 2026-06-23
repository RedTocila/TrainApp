"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSubscribedMutation } from "@/lib/actions/subscriptions";

export async function getTaskCompletionsInRange(
  clientId: string,
  from: string,
  to: string
): Promise<Record<string, Set<string>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_task_completions")
    .select("date, task_id")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  const map: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    if (!map[row.date]) map[row.date] = new Set();
    map[row.date].add(row.task_id);
  }
  return map;
}

export async function getTaskCompletionsForDate(
  clientId: string,
  date: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_task_completions")
    .select("task_id")
    .eq("client_id", clientId)
    .eq("date", date);

  return new Set((data ?? []).map((r) => r.task_id));
}

export async function toggleScheduleTaskCompletion(
  clientId: string,
  date: string,
  taskId: string
) {
  const access = await ensureSubscribedMutation();
  if ("error" in access) return { error: access.error, completed: false };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("schedule_task_completions")
    .select("task_id")
    .eq("client_id", clientId)
    .eq("date", date)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("schedule_task_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("date", date)
      .eq("task_id", taskId);
    if (error) return { error: error.message, completed: false };
  } else {
    const { error } = await supabase.from("schedule_task_completions").insert({
      client_id: clientId,
      date,
      task_id: taskId,
    });
    if (error) return { error: error.message, completed: true };
  }

  revalidatePath("/dashboard");
  return { completed: !existing };
}
