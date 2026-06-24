"use server";

import { getHabitCompletionsInRange } from "@/lib/actions/habits";
import { getTaskCompletionsInRange } from "@/lib/actions/task-completions";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { createClient } from "@/lib/supabase/server";
import type { DailyMealLog } from "@/lib/types";

function mergeCompletionMaps(
  ...maps: Record<string, Set<string>>[]
): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};

  for (const map of maps) {
    for (const [date, ids] of Object.entries(map)) {
      if (!merged[date]) merged[date] = new Set();
      for (const id of ids) merged[date].add(id);
    }
  }

  const out: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(merged)) {
    out[date] = [...ids];
  }
  return out;
}

export async function fetchDashboardEnrichmentFields(
  clientId: string,
  from: string,
  to: string
): Promise<
  Pick<
    DashboardEnrichmentData,
    "waterByDate" | "mealsByDate" | "workoutCompletedDates"
  >
> {
  const supabase = await createClient();

  const [logsResult, mealsResult, workoutsResult] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("date, water_ml")
      .eq("client_id", clientId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("daily_meal_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", from)
      .lte("date", to)
      .order("logged_at"),
    supabase
      .from("workout_sessions")
      .select("scheduled_date")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to),
  ]);

  const waterByDate: Record<string, number> = {};
  for (const row of logsResult.data ?? []) {
    waterByDate[row.date] = row.water_ml ?? 0;
  }

  const mealsByDate: Record<string, DailyMealLog[]> = {};
  for (const row of (mealsResult.data ?? []) as DailyMealLog[]) {
    if (!mealsByDate[row.date]) mealsByDate[row.date] = [];
    mealsByDate[row.date].push(row);
  }

  const workoutCompletedDates = [
    ...new Set((workoutsResult.data ?? []).map((row) => row.scheduled_date)),
  ];

  return { waterByDate, mealsByDate, workoutCompletedDates };
}

export async function fetchDashboardEnrichmentData(
  clientId: string,
  from: string,
  to: string
): Promise<DashboardEnrichmentData> {
  const supabase = await createClient();

  const [
    taskCompletions,
    habitCompletions,
    fields,
    profileResult,
  ] = await Promise.all([
    getTaskCompletionsInRange(clientId, from, to),
    getHabitCompletionsInRange(clientId, from, to),
    fetchDashboardEnrichmentFields(clientId, from, to),
    supabase.from("profiles").select("created_at").eq("id", clientId).maybeSingle(),
  ]);

  return {
    completionsByDate: mergeCompletionMaps(taskCompletions, habitCompletions),
    ...fields,
    accountCreatedAt: profileResult.data?.created_at ?? null,
  };
}

/** Lightweight fetch for a single day — used after user actions instead of full range reload. */
export async function fetchDashboardEnrichmentForDate(
  clientId: string,
  dateKey: string
): Promise<DashboardEnrichmentData> {
  return fetchDashboardEnrichmentData(clientId, dateKey, dateKey);
}
