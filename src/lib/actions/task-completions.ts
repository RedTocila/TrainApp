"use server";

import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import { isCardioDurationComplete } from "@/lib/cardio-completion";
import { cardioTaskId, isCardioTaskId } from "@/lib/cardio-task-id";

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

export async function getCardioCompletionForDate(
  clientId: string,
  date: string,
  cardioId?: string | null
): Promise<{ completed: boolean; elapsedSeconds: number | null }> {
  const supabase = await createClient();
  const taskIds = cardioId
    ? [cardioTaskId(date, cardioId)]
    : [cardioTaskId(date)];

  const { data } = await supabase
    .from("schedule_task_completions")
    .select("task_id, elapsed_seconds")
    .eq("client_id", clientId)
    .eq("date", date)
    .in("task_id", taskIds)
    .maybeSingle();

  if (!data) return { completed: false, elapsedSeconds: null };

  return {
    completed: true,
    elapsedSeconds:
      typeof data.elapsed_seconds === "number" ? data.elapsed_seconds : null,
  };
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

/** Mark a schedule task complete (idempotent upsert — never accidentally uncompletes). */
export async function completeScheduleTask(
  clientId: string,
  date: string,
  taskId: string,
  options?: {
    elapsedSeconds?: number | null;
    plannedMinutes?: number | null;
  }
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error, completed: false };

  const { admin } = mutation;
  const completedAt = new Date().toISOString();
  const elapsedSeconds =
    options?.elapsedSeconds != null && Number.isFinite(options.elapsedSeconds)
      ? Math.max(0, Math.floor(options.elapsedSeconds))
      : null;

  if (
    isCardioTaskId(taskId) &&
    !isCardioDurationComplete(elapsedSeconds ?? 0, options?.plannedMinutes)
  ) {
    return {
      error: "Cardio duration is too short to mark complete",
      completed: false,
    };
  }

  const row = {
    client_id: clientId,
    date,
    task_id: taskId,
    completed_at: completedAt,
    elapsed_seconds: elapsedSeconds,
  };

  let { error } = await admin
    .from("schedule_task_completions")
    .upsert(row, { onConflict: "client_id,date,task_id" });

  // Older DBs may not have elapsed_seconds yet — still mark complete.
  if (error && /elapsed_seconds/i.test(error.message)) {
    const fallback = await admin.from("schedule_task_completions").upsert(
      {
        client_id: clientId,
        date,
        task_id: taskId,
        completed_at: completedAt,
      },
      { onConflict: "client_id,date,task_id" }
    );
    error = fallback.error;
  }

  if (error) return { error: formatDbError(error.message), completed: false };
  return { completed: true, completedAt, elapsedSeconds };
}
