"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Challenge, ChallengeParticipant } from "@/lib/types";
import { getChallengeEndDate } from "@/lib/challenge-utils";
import { formatDateKey } from "@/lib/utils";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import {
  computePlatformScoreBreakdown,
  type PlatformScoreBreakdown,
} from "@/lib/platform-engagement-score";

type DailyInputs = {
  hasWorkout: boolean;
  mealProtein: number;
  mealCount: number;
  habitCount: number;
  waterMl: number;
  waterGoal: number;
  proteinTarget: number;
};

function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function enumerateDateKeys(fromKey: string, toKey: string): string[] {
  const result: string[] = [];
  let cursor = new Date(`${fromKey}T12:00:00`);
  const end = new Date(`${toKey}T12:00:00`);
  while (cursor <= end) {
    result.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function dailyBreakdownFromInputs(input: DailyInputs): PlatformScoreBreakdown {
  const nutrition = (() => {
    if (input.mealCount <= 0) return 0;
    if (input.proteinTarget <= 0) return 50;
    const ratio = Math.min(1, input.mealProtein / Math.max(1, input.proteinTarget * 0.85));
    return Math.round(ratio * 100);
  })();

  const workout = input.hasWorkout ? 100 : 0;
  const habits = input.habitCount > 0 ? 100 : 0;
  const water = waterMetDailyMinimum(input.waterMl, input.waterGoal) ? 100 : 0;

  // Reuse the existing 50/30/20 weighting shape.
  return computePlatformScoreBreakdown({
    daysInPeriod: 1,
    workoutsCompleted: workout ? 1 : 0,
    daysWithMeals: input.mealCount > 0 ? 1 : 0,
    daysWithWaterGoalMet: water ? 1 : 0,
    habitCompletions: habits ? 1 : 0,
    avgProtein: input.mealCount > 0 ? Math.round(input.mealProtein) : 0,
    proteinTarget: input.proteinTarget,
  });
}

async function fetchLongChallengeInputs(
  supabase: SupabaseClient,
  userIds: string[],
  fromKey: string,
  toKey: string
) {
  const [profilesResult, workoutsResult, mealsResult, habitsResult, logsResult] =
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
        .gte("completed_at", `${fromKey}T00:00:00`)
        .lte("completed_at", `${toKey}T23:59:59.999Z`),
      supabase
        .from("daily_meal_logs")
        .select("client_id, date, protein")
        .in("client_id", userIds)
        .gte("date", fromKey)
        .lte("date", toKey),
      supabase
        .from("habit_completions")
        .select("client_id, date")
        .in("client_id", userIds)
        .gte("date", fromKey)
        .lte("date", toKey),
      supabase
        .from("daily_logs")
        .select("client_id, date, water_ml")
        .in("client_id", userIds)
        .gte("date", fromKey)
        .lte("date", toKey),
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

  const workoutDays = new Map<string, Set<string>>();
  for (const row of workoutsResult.data ?? []) {
    const userId = row.client_id as string;
    const dateKey = row.completed_at ? dateKeyFromIso(row.completed_at as string) : null;
    if (!dateKey) continue;
    if (!workoutDays.has(userId)) workoutDays.set(userId, new Set());
    workoutDays.get(userId)!.add(dateKey);
  }

  const mealProteinByDay = new Map<string, Map<string, { protein: number; count: number }>>();
  for (const row of mealsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    const protein = (row.protein as number | null) ?? 0;
    if (!mealProteinByDay.has(userId)) mealProteinByDay.set(userId, new Map());
    const map = mealProteinByDay.get(userId)!;
    const current = map.get(date) ?? { protein: 0, count: 0 };
    map.set(date, { protein: current.protein + protein, count: current.count + 1 });
  }

  const habitCountByDay = new Map<string, Map<string, number>>();
  for (const row of habitsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    if (!habitCountByDay.has(userId)) habitCountByDay.set(userId, new Map());
    const map = habitCountByDay.get(userId)!;
    map.set(date, (map.get(date) ?? 0) + 1);
  }

  const waterByDay = new Map<string, Map<string, number>>();
  for (const row of logsResult.data ?? []) {
    const userId = row.client_id as string;
    const date = row.date as string;
    const water = (row.water_ml as number | null) ?? 0;
    if (!waterByDay.has(userId)) waterByDay.set(userId, new Map());
    waterByDay.get(userId)!.set(date, water);
  }

  return {
    proteinTargetByUser,
    waterGoalByUser,
    workoutDays,
    mealProteinByDay,
    habitCountByDay,
    waterByDay,
  };
}

/**
 * Long challenges leaderboard points:
 * - Each calendar day scores 0–100 based on the 50/30/20 weighting.
 * - Total points = sum(dailyScore) from join date to today (or challenge end), capped by days*100.
 */
export async function getLongChallengeAccumulatedPoints(
  challenge: Pick<Challenge, "scheduled_at" | "duration_days" | "duration_months">,
  participants: Pick<ChallengeParticipant, "user_id" | "created_at">[]
): Promise<Record<string, number>> {
  if (participants.length === 0) return {};

  const supabase = await createClient();
  const todayKey = formatDateKey(new Date());
  const challengeEndKey = formatDateKey(getChallengeEndDate(challenge as Challenge));
  const toKey = challengeEndKey < todayKey ? challengeEndKey : todayKey;

  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const sinceByUser = new Map(participants.map((p) => [p.user_id, dateKeyFromIso(p.created_at)]));

  const earliestKey = participants.reduce((min, p) => {
    const key = dateKeyFromIso(p.created_at);
    return key < min ? key : min;
  }, dateKeyFromIso(participants[0]!.created_at));

  const data = await fetchLongChallengeInputs(supabase, userIds, earliestKey, toKey);

  const totals: Record<string, number> = {};

  for (const userId of userIds) {
    const fromKey = sinceByUser.get(userId) ?? earliestKey;
    const days = enumerateDateKeys(fromKey, toKey);
    let total = 0;

    const proteinTarget = data.proteinTargetByUser.get(userId) ?? 150;
    const waterGoal = data.waterGoalByUser.get(userId) ?? 2500;
    const workoutSet = data.workoutDays.get(userId) ?? new Set<string>();
    const mealByDay = data.mealProteinByDay.get(userId) ?? new Map();
    const habitByDay = data.habitCountByDay.get(userId) ?? new Map();
    const waterDay = data.waterByDay.get(userId) ?? new Map();

    for (const dateKey of days) {
      const meal = mealByDay.get(dateKey) ?? { protein: 0, count: 0 };
      const breakdown = dailyBreakdownFromInputs({
        hasWorkout: workoutSet.has(dateKey),
        mealProtein: meal.protein,
        mealCount: meal.count,
        habitCount: habitByDay.get(dateKey) ?? 0,
        waterMl: waterDay.get(dateKey) ?? 0,
        waterGoal,
        proteinTarget,
      });
      total += Math.min(100, Math.max(0, breakdown.overall));
    }

    totals[userId] = total;
  }

  return totals;
}

/** Admin helper (optional): compute points with admin client (RLS-safe). */
export async function getAdminLongChallengeAccumulatedPoints(
  challenge: Pick<Challenge, "scheduled_at" | "duration_days" | "duration_months">,
  participants: Pick<ChallengeParticipant, "user_id" | "created_at">[]
): Promise<Record<string, number>> {
  if (participants.length === 0) return {};
  const supabase = createAdminClient();
  const todayKey = formatDateKey(new Date());
  const challengeEndKey = formatDateKey(getChallengeEndDate(challenge as Challenge));
  const toKey = challengeEndKey < todayKey ? challengeEndKey : todayKey;

  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const sinceByUser = new Map(participants.map((p) => [p.user_id, dateKeyFromIso(p.created_at)]));

  const earliestKey = participants.reduce((min, p) => {
    const key = dateKeyFromIso(p.created_at);
    return key < min ? key : min;
  }, dateKeyFromIso(participants[0]!.created_at));

  const data = await fetchLongChallengeInputs(supabase, userIds, earliestKey, toKey);
  const totals: Record<string, number> = {};

  for (const userId of userIds) {
    const fromKey = sinceByUser.get(userId) ?? earliestKey;
    const days = enumerateDateKeys(fromKey, toKey);
    let total = 0;

    const proteinTarget = data.proteinTargetByUser.get(userId) ?? 150;
    const waterGoal = data.waterGoalByUser.get(userId) ?? 2500;
    const workoutSet = data.workoutDays.get(userId) ?? new Set<string>();
    const mealByDay = data.mealProteinByDay.get(userId) ?? new Map();
    const habitByDay = data.habitCountByDay.get(userId) ?? new Map();
    const waterDay = data.waterByDay.get(userId) ?? new Map();

    for (const dateKey of days) {
      const meal = mealByDay.get(dateKey) ?? { protein: 0, count: 0 };
      const breakdown = dailyBreakdownFromInputs({
        hasWorkout: workoutSet.has(dateKey),
        mealProtein: meal.protein,
        mealCount: meal.count,
        habitCount: habitByDay.get(dateKey) ?? 0,
        waterMl: waterDay.get(dateKey) ?? 0,
        waterGoal,
        proteinTarget,
      });
      total += Math.min(100, Math.max(0, breakdown.overall));
    }

    totals[userId] = total;
  }

  return totals;
}

