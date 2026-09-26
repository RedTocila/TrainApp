"use server";

import { createClient } from "@/lib/supabase/server";
import { getBodyWeightHistory } from "@/lib/actions/weight-logs";

export type ClientProgressSummary = {
  workoutsCompleted: number;
  workoutsThisWeek: number;
  streakDays: number;
  latestWeightKg: number | null;
  weightDeltaKg: number | null;
  weightEntries: number;
};

function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function computeStreak(completedDates: string[]): number {
  if (!completedDates.length) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const cursor = new Date();
  // Allow yesterday as the tip if today isn't done yet.
  if (!set.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(dateKey(cursor))) return 0;
  }
  while (set.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Lightweight progress snapshot for the iOS Progress tab (single query batch). */
export async function getClientProgressSummary(
  clientId: string
): Promise<ClientProgressSummary> {
  const supabase = await createClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekKey = dateKey(weekAgo);

  const [{ count }, { data: recentSessions }, weightHistory] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "completed"),
    supabase
      .from("workout_sessions")
      .select("completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(120),
    getBodyWeightHistory(clientId, 90),
  ]);

  const completedDates = (recentSessions ?? [])
    .map((row) =>
      row.completed_at ? String(row.completed_at).slice(0, 10) : null
    )
    .filter((d): d is string => Boolean(d));

  const uniqueDates = Array.from(new Set(completedDates));
  const workoutsThisWeek = uniqueDates.filter((d) => d >= weekKey).length;

  const first = weightHistory[0];
  const latest = weightHistory[weightHistory.length - 1];
  const latestKg = latest?.weight_kg != null ? Number(latest.weight_kg) : null;
  const firstKg = first?.weight_kg != null ? Number(first.weight_kg) : null;

  return {
    workoutsCompleted: count ?? 0,
    workoutsThisWeek,
    streakDays: computeStreak(uniqueDates),
    latestWeightKg: latestKg,
    weightDeltaKg:
      latestKg != null && firstKg != null ? latestKg - firstKg : null,
    weightEntries: weightHistory.length,
  };
}
