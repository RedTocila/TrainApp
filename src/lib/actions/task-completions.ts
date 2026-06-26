"use server";

import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";

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
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error, completed: false };

  const { admin } = mutation;
  const { data: existing } = await admin
    .from("schedule_task_completions")
    .select("task_id")
    .eq("client_id", clientId)
    .eq("date", date)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("schedule_task_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("date", date)
      .eq("task_id", taskId);
    if (error) return { error: formatDbError(error.message), completed: false };
  } else {
    const { error } = await admin.from("schedule_task_completions").insert({
      client_id: clientId,
      date,
      task_id: taskId,
    });
    if (error) return { error: formatDbError(error.message), completed: true };
  }

  return { completed: !existing };
}
