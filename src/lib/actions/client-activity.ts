"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type ClientActivityType =
  | "meal"
  | "workout"
  | "weight"
  | "habit"
  | "task";

export interface ClientActivityItem {
  id: string;
  clientId: string;
  clientName?: string;
  type: ClientActivityType;
  title: string;
  detail?: string;
  occurredAt: string;
}

function mergeActivities(items: ClientActivityItem[], limit: number) {
  return items
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit);
}

export async function getClientActivityFeed(
  clientId: string,
  limit = 40
): Promise<ClientActivityItem[]> {
  const admin = createAdminClient();

  const [meals, workouts, weights, habits, tasks, habitTitles] = await Promise.all([
    admin
      .from("daily_meal_logs")
      .select("id, name, calories, meal_type, logged_at")
      .eq("client_id", clientId)
      .order("logged_at", { ascending: false })
      .limit(limit),
    admin
      .from("workout_sessions")
      .select("id, plan_title, day_title, status, completed_at, started_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit),
    admin
      .from("body_weight_logs")
      .select("id, weight_kg, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("habit_completions")
      .select("habit_id, completed_at, date")
      .eq("client_id", clientId)
      .order("completed_at", { ascending: false })
      .limit(limit),
    admin
      .from("schedule_task_completions")
      .select("task_id, completed_at, date")
      .eq("client_id", clientId)
      .order("completed_at", { ascending: false })
      .limit(limit),
    admin.from("client_habits").select("id, title").eq("client_id", clientId),
  ]);

  const habitNameById = new Map(
    (habitTitles.data ?? []).map((h) => [h.id as string, h.title as string])
  );

  const items: ClientActivityItem[] = [];

  for (const meal of meals.data ?? []) {
    items.push({
      id: `meal-${meal.id}`,
      clientId,
      type: "meal",
      title: `Logged meal: ${meal.name}`,
      detail: `${meal.calories} kcal · ${meal.meal_type}`,
      occurredAt: meal.logged_at as string,
    });
  }

  for (const session of workouts.data ?? []) {
    const at = (session.completed_at ?? session.started_at) as string;
    items.push({
      id: `workout-${session.id}`,
      clientId,
      type: "workout",
      title: "Completed workout",
      detail: [session.plan_title, session.day_title].filter(Boolean).join(" · ") || undefined,
      occurredAt: at,
    });
  }

  for (const log of weights.data ?? []) {
    items.push({
      id: `weight-${log.id}`,
      clientId,
      type: "weight",
      title: "Logged weight",
      detail: `${log.weight_kg} kg`,
      occurredAt: log.created_at as string,
    });
  }

  for (const habit of habits.data ?? []) {
    items.push({
      id: `habit-${habit.habit_id}-${habit.date}`,
      clientId,
      type: "habit",
      title: "Completed habit",
      detail: habitNameById.get(habit.habit_id as string) ?? "Habit",
      occurredAt: habit.completed_at as string,
    });
  }

  for (const task of tasks.data ?? []) {
    items.push({
      id: `task-${task.task_id}-${task.date}`,
      clientId,
      type: "task",
      title: "Completed daily task",
      detail: String(task.task_id).replace(/_/g, " "),
      occurredAt: task.completed_at as string,
    });
  }

  return mergeActivities(items, limit);
}

export async function getRecentClientActivity(
  limit = 25
): Promise<ClientActivityItem[]> {
  const admin = createAdminClient();
  const { data: clients } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!clients?.length) return [];

  const nameById = new Map(clients.map((c) => [c.id as string, c.full_name as string]));
  const perClient = await Promise.all(
    clients.map((c) => getClientActivityFeed(c.id as string, 8))
  );

  const merged = perClient
    .flat()
    .map((item) => ({
      ...item,
      clientName: nameById.get(item.clientId),
    }));

  return mergeActivities(merged, limit);
}

export async function getClientLastActivityAt(
  clientId: string
): Promise<string | null> {
  const feed = await getClientActivityFeed(clientId, 1);
  return feed[0]?.occurredAt ?? null;
}

export async function getClientsLastActivityMap(
  clientIds: string[]
): Promise<Record<string, string>> {
  if (clientIds.length === 0) return {};

  const admin = createAdminClient();
  const [meals, workouts, weights, habits, tasks] = await Promise.all([
    admin
      .from("daily_meal_logs")
      .select("client_id, logged_at")
      .in("client_id", clientIds)
      .order("logged_at", { ascending: false })
      .limit(150),
    admin
      .from("workout_sessions")
      .select("client_id, completed_at, started_at")
      .in("client_id", clientIds)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(150),
    admin
      .from("body_weight_logs")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("habit_completions")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .order("completed_at", { ascending: false })
      .limit(150),
    admin
      .from("schedule_task_completions")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .order("completed_at", { ascending: false })
      .limit(150),
  ]);

  const latest: Record<string, string> = {};

  const consider = (clientId: string, at: string | null | undefined) => {
    if (!at) return;
    const prev = latest[clientId];
    if (!prev || new Date(at) > new Date(prev)) {
      latest[clientId] = at;
    }
  };

  for (const row of meals.data ?? []) {
    consider(row.client_id as string, row.logged_at as string);
  }
  for (const row of workouts.data ?? []) {
    consider(
      row.client_id as string,
      (row.completed_at ?? row.started_at) as string
    );
  }
  for (const row of weights.data ?? []) {
    consider(row.client_id as string, row.created_at as string);
  }
  for (const row of habits.data ?? []) {
    consider(row.client_id as string, row.completed_at as string);
  }
  for (const row of tasks.data ?? []) {
    consider(row.client_id as string, row.completed_at as string);
  }

  return latest;
}
