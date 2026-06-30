"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computePlatformScoreBreakdown,
  daysSinceDate,
  type PlatformEngagementMetrics,
  type PlatformScoreBreakdown,
  type PlatformScoreEntry,
} from "@/lib/platform-engagement-score";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import {
  resolveClientScoreSince,
  type ClientScorePeriod,
} from "@/lib/client-score-period";
import { formatDateKey } from "@/lib/utils";

export type ParticipantScoreInput = {
  userId: string;
  since: string;
};

export type { PlatformScoreEntry, PlatformScoreBreakdown } from "@/lib/platform-engagement-score";

export type ParticipantPlatformScore = {
  userId: string;
  score: number;
  breakdown: PlatformScoreBreakdown;
  metrics: PlatformEngagementMetrics;
};

function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export async function getPlatformEngagementScores(
  participants: ParticipantScoreInput[]
): Promise<Record<string, PlatformScoreEntry>> {
  const detailed = await getPlatformEngagementScoresDetailed(participants);
  return Object.fromEntries(
    Object.entries(detailed).map(([userId, entry]) => [
      userId,
      { score: entry.score, breakdown: entry.breakdown },
    ])
  );
}

export async function getPlatformEngagementScoresDetailed(
  participants: ParticipantScoreInput[]
): Promise<Record<string, ParticipantPlatformScore>> {
  const supabase = await createClient();
  return fetchPlatformEngagementScoresDetailed(supabase, participants);
}

export async function getAdminClientsPlatformScores(
  clients: { id: string; created_at: string }[],
  period: ClientScorePeriod = "all"
): Promise<Record<string, PlatformScoreEntry>> {
  await requireAdmin();
  if (clients.length === 0) return {};

  const admin = createAdminClient();
  const participants = clients.map((client) => ({
    userId: client.id,
    since: resolveClientScoreSince(period, client.created_at),
  }));
  const detailed = await fetchPlatformEngagementScoresDetailed(admin, participants);
  return Object.fromEntries(
    Object.entries(detailed).map(([userId, entry]) => [
      userId,
      { score: entry.score, breakdown: entry.breakdown },
    ])
  );
}

async function fetchPlatformEngagementScoresDetailed(
  supabase: SupabaseClient,
  participants: ParticipantScoreInput[]
): Promise<Record<string, ParticipantPlatformScore>> {
  if (participants.length === 0) return {};
  const todayKey = formatDateKey(new Date());
  const earliestKey = participants.reduce((min, p) => {
    const key = dateKeyFromIso(p.since);
    return key < min ? key : min;
  }, dateKeyFromIso(participants[0].since));

  const userIds = [...new Set(participants.map((p) => p.userId))];
  const sinceByUser = new Map(
    participants.map((p) => [p.userId, dateKeyFromIso(p.since)])
  );

  const [profilesResult, workoutsResult, mealsResult, habitsResult, dailyLogsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, target_protein, water_goal_ml")
        .in("id", userIds),
      supabase
        .from("workout_sessions")
        .select("client_id, completed_at")
        .in("client_id", userIds)
        .eq("status", "completed")
        .gte("completed_at", `${earliestKey}T00:00:00`),
      supabase
        .from("daily_meal_logs")
        .select("client_id, date, protein")
        .in("client_id", userIds)
        .gte("date", earliestKey)
        .lte("date", todayKey),
      supabase
        .from("habit_completions")
        .select("client_id, date")
        .in("client_id", userIds)
        .gte("date", earliestKey)
        .lte("date", todayKey),
      supabase
        .from("daily_logs")
        .select("client_id, date, water_ml")
        .in("client_id", userIds)
        .gte("date", earliestKey)
        .lte("date", todayKey),
    ]);

  const proteinTargetByUser = new Map<string, number>(
    (profilesResult.data ?? []).map((row) => [
      row.id as string,
      (row.target_protein as number | null) ?? 150,
    ])
  );
  const waterGoalByUser = new Map<string, number>(
    (profilesResult.data ?? []).map((row) => [
      row.id as string,
      (row.water_goal_ml as number | null) ?? 2500,
    ])
  );

  const workoutsByUser = new Map<string, number>();
  for (const row of workoutsResult.data ?? []) {
    const userId = row.client_id as string;
    const since = sinceByUser.get(userId) ?? earliestKey;
    const completedKey = row.completed_at
      ? dateKeyFromIso(row.completed_at as string)
      : null;
    if (!completedKey || completedKey < since || completedKey > todayKey) continue;
    workoutsByUser.set(userId, (workoutsByUser.get(userId) ?? 0) + 1);
  }

  const mealDaysByUser = new Map<string, Set<string>>();
  const proteinSumByUser = new Map<string, number>();
  for (const row of mealsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    const since = sinceByUser.get(userId) ?? earliestKey;
    if (date < since || date > todayKey) continue;
    if (!mealDaysByUser.has(userId)) mealDaysByUser.set(userId, new Set());
    mealDaysByUser.get(userId)!.add(date);
    proteinSumByUser.set(
      userId,
      (proteinSumByUser.get(userId) ?? 0) + ((row.protein as number | null) ?? 0)
    );
  }

  const habitsByUser = new Map<string, number>();
  for (const row of habitsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    const since = sinceByUser.get(userId) ?? earliestKey;
    if (date < since || date > todayKey) continue;
    habitsByUser.set(userId, (habitsByUser.get(userId) ?? 0) + 1);
  }

  const waterDaysByUser = new Map<string, Set<string>>();
  for (const row of dailyLogsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    const since = sinceByUser.get(userId) ?? earliestKey;
    if (date < since || date > todayKey) continue;
    const waterMl = (row.water_ml as number | null) ?? 0;
    const waterGoal = waterGoalByUser.get(userId) ?? 2500;
    if (!waterMetDailyMinimum(waterMl, waterGoal)) continue;
    if (!waterDaysByUser.has(userId)) waterDaysByUser.set(userId, new Set());
    waterDaysByUser.get(userId)!.add(date);
  }

  const result: Record<string, ParticipantPlatformScore> = {};

  for (const participant of participants) {
    const { userId, since } = participant;
    const sinceKey = dateKeyFromIso(since);
    const daysInPeriod = daysSinceDate(sinceKey);
    const daysWithMeals = [...(mealDaysByUser.get(userId) ?? [])].filter(
      (date) => date >= sinceKey
    ).length;
    const avgProtein =
      daysWithMeals > 0
        ? Math.round((proteinSumByUser.get(userId) ?? 0) / daysWithMeals)
        : 0;

    const metrics: PlatformEngagementMetrics = {
      daysInPeriod,
      workoutsCompleted: workoutsByUser.get(userId) ?? 0,
      daysWithMeals,
      daysWithWaterGoalMet: [...(waterDaysByUser.get(userId) ?? [])].filter(
        (date) => date >= sinceKey
      ).length,
      habitCompletions: habitsByUser.get(userId) ?? 0,
      avgProtein,
      proteinTarget: proteinTargetByUser.get(userId) ?? 150,
    };

    const breakdown = computePlatformScoreBreakdown(metrics);

    result[userId] = {
      userId,
      score: breakdown.overall,
      breakdown,
      metrics,
    };
  }

  return result;
}
