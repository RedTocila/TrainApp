"use server";

import { getHabitCompletionsInRange } from "@/lib/actions/habits";
import { getTaskCompletionsInRange } from "@/lib/actions/task-completions";
import { getWorkoutCompletedTaskIdsInRange } from "@/lib/actions/workout-sessions";
import {
  mergeCompletionMaps,
  mergeWorkoutTaskCompletionsInto,
} from "@/lib/dashboard-enrichment-utils";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { createClient } from "@/lib/supabase/server";
import type { DailyMealLog } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";

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

  const [logsResult, mealsResult, scheduledWorkoutsResult, unscheduledWorkoutsResult] =
    await Promise.all([
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
      .select("scheduled_date, completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to),
    supabase
      .from("workout_sessions")
      .select("scheduled_date, completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .is("scheduled_date", null)
      .gte("completed_at", `${from}T00:00:00`)
      .lte("completed_at", `${to}T23:59:59.999Z`),
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
    ...new Set(
      [...(scheduledWorkoutsResult.data ?? []), ...(unscheduledWorkoutsResult.data ?? [])]
        .map((row) =>
          row.scheduled_date ??
          (row.completed_at ? formatDateKey(new Date(row.completed_at)) : null)
        )
        .filter((dateKey): dateKey is string => !!dateKey)
    ),
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
    workoutTaskCompletions,
    fields,
    profileResult,
  ] = await Promise.all([
    getTaskCompletionsInRange(clientId, from, to),
    getHabitCompletionsInRange(clientId, from, to),
    getWorkoutCompletedTaskIdsInRange(clientId, from, to),
    fetchDashboardEnrichmentFields(clientId, from, to),
    supabase.from("profiles").select("created_at").eq("id", clientId).maybeSingle(),
  ]);

  return {
    completionsByDate: mergeWorkoutTaskCompletionsInto(
      mergeCompletionMaps(taskCompletions, habitCompletions),
      workoutTaskCompletions
    ),
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
