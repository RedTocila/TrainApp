/**
 * Workout variety: score/penalize exercises based on recent session + active-plan usage.
 * Does not hard-forbid repeats — weighted selection prefers fresher alternatives.
 */

import { createClient } from "@/lib/supabase/server";
import { getClientWorkoutAssignment } from "@/lib/actions/plans";
import { canonicalizeAiExerciseName } from "@/lib/exercise-catalog";

export type ExerciseUsageRecord = {
  /** Lowercase canonical / raw name key. */
  nameKey: string;
  /** Times seen in the lookback window (sessions + active plan). */
  count: number;
  /** Days since last appearance (0 = today / active plan). */
  lastUsedDaysAgo: number;
};

export type VarietyContext = {
  usageByName: Map<string, ExerciseUsageRecord>;
  /** Lookback window in days. */
  windowDays: number;
  /** How many distinct exercise name hits were loaded. */
  trackedNames: number;
};

const DEFAULT_WINDOW_DAYS = 21;

function normalizeNameKey(name: string): string {
  const canon = canonicalizeAiExerciseName(name.trim());
  return (canon || name).toLowerCase().trim();
}

function daysBetween(isoDate: string, today: Date): number {
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return 999;
  const ms = today.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function bumpUsage(
  map: Map<string, ExerciseUsageRecord>,
  name: string,
  daysAgo: number
): void {
  const key = normalizeNameKey(name);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { nameKey: key, count: 1, lastUsedDaysAgo: daysAgo });
    return;
  }
  existing.count += 1;
  existing.lastUsedDaysAgo = Math.min(existing.lastUsedDaysAgo, daysAgo);
}

/**
 * Build variety context from completed sessions (lookback) + active plan exercises.
 * Failures return an empty context so generation still works.
 */
export async function loadExerciseVarietyContext(
  clientId: string,
  options?: { windowDays?: number }
): Promise<VarietyContext> {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const usageByName = new Map<string, ExerciseUsageRecord>();
  const today = new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - windowDays);
  const sinceIso = since.toISOString();

  try {
    const supabase = await createClient();
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false })
      .limit(40);

    if (sessions?.length) {
      const sessionIds = sessions.map((s) => s.id);
      const completedAtById = new Map(
        sessions.map((s) => [s.id, s.completed_at as string])
      );

      const { data: exercises } = await supabase
        .from("workout_session_exercises")
        .select("session_id, name")
        .in("session_id", sessionIds);

      for (const row of exercises ?? []) {
        const completedAt = completedAtById.get(row.session_id);
        const daysAgo = completedAt ? daysBetween(completedAt, today) : 7;
        bumpUsage(usageByName, row.name, daysAgo);
      }
    }
  } catch (err) {
    console.warn("[workout-variety] session load failed", err);
  }

  try {
    const assignment = await getClientWorkoutAssignment(clientId);
    const days = assignment?.workout_plans?.workout_days ?? [];
    for (const day of days) {
      for (const ex of day.exercises ?? []) {
        if (ex?.name) bumpUsage(usageByName, ex.name, 0);
      }
    }
  } catch (err) {
    console.warn("[workout-variety] active plan load failed", err);
  }

  return {
    usageByName,
    windowDays,
    trackedNames: usageByName.size,
  };
}

/**
 * Score delta for candidate ranking (negative = deprioritize).
 * Never removes exercises — only reorders the pool.
 */
export function varietyScoreDelta(
  exerciseName: string,
  variety: VarietyContext | null | undefined,
  varietyLevel: "normal" | "high" = "normal"
): number {
  if (!variety || variety.usageByName.size === 0) return 0;

  const key = normalizeNameKey(exerciseName);
  const usage = variety.usageByName.get(key);
  if (!usage) {
    // Never used recently — small boost, stronger when user asked for "something different".
    return varietyLevel === "high" ? 18 : 6;
  }

  const mult = varietyLevel === "high" ? 1.6 : 1;
  let penalty = 0;

  // Recency penalty
  if (usage.lastUsedDaysAgo <= 2) penalty += 45;
  else if (usage.lastUsedDaysAgo <= 7) penalty += 28;
  else if (usage.lastUsedDaysAgo <= 14) penalty += 14;
  else penalty += 6;

  // Frequency penalty
  penalty += Math.min(40, (usage.count - 1) * 12);

  return -Math.round(penalty * mult);
}

/** Prompt hint listing heavily used recent exercises to avoid when alternatives exist. */
export function buildVarietyPromptHint(
  variety: VarietyContext | null | undefined,
  varietyLevel: "normal" | "high"
): string {
  if (!variety || variety.usageByName.size === 0) return "";

  const hot = [...variety.usageByName.values()]
    .filter((u) => u.lastUsedDaysAgo <= 7 || u.count >= 2)
    .sort(
      (a, b) =>
        a.lastUsedDaysAgo - b.lastUsedDaysAgo || b.count - a.count
    )
    .slice(0, 12)
    .map((u) => u.nameKey);

  if (hot.length === 0) return "";

  const strength =
    varietyLevel === "high"
      ? "HIGH variety requested — strongly prefer exercises NOT in this recent list when allowed alternatives exist"
      : "Prefer less-recently-used exercises when equally suitable";

  return `- Variety: ${strength}. Recently used (deprioritize): ${hot
    .map((n) => `"${n}"`)
    .join(", ")}.`;
}

/** Test helper: build context from a plain usage list. */
export function varietyContextFromUsage(
  entries: { name: string; count: number; lastUsedDaysAgo: number }[],
  windowDays = DEFAULT_WINDOW_DAYS
): VarietyContext {
  const usageByName = new Map<string, ExerciseUsageRecord>();
  for (const e of entries) {
    const key = normalizeNameKey(e.name);
    usageByName.set(key, {
      nameKey: key,
      count: e.count,
      lastUsedDaysAgo: e.lastUsedDaysAgo,
    });
  }
  return { usageByName, windowDays, trackedNames: usageByName.size };
}
