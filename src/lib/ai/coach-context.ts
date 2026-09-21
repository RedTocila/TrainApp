import { createClient } from "@/lib/supabase/server";
import { getBodyWeightHistory } from "@/lib/actions/weight-logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import type { MacroGap } from "@/lib/ai/types";
import {
  buildDailyProgressContextForAi,
  loadDailyProgressSnapshot,
  type DailyProgressSnapshot,
} from "@/lib/ai/daily-progress-context";
import {
  buildProgressPhotoContextForAi,
  getProgressPhotoSetsWithAnalysis,
  summarizeProgressPhotosForCoach,
} from "@/lib/ai/progress-photo-context";
import {
  buildProgressHistorySummary,
  type ProgressHistorySummary,
} from "@/lib/ai/progress-history-summary";
import type { DailyMealLog, Profile } from "@/lib/types";
import {
  dailyMacroSurplus,
  dailyMacrosExceededUpperLimit,
  macroToleranceBand,
} from "@/lib/macro-targets";
import { sumMealMacros, type MealMacros } from "@/lib/meal-utils";

function buildMacroGap(consumed: MealMacros, targets: MacroGap["targets"]): MacroGap {
  const surplus = dailyMacroSurplus(consumed, targets);
  const overTolerance = dailyMacrosExceededUpperLimit(consumed, targets);

  const remaining = (key: keyof MealMacros) => {
    const target = targets[key];
    if (target <= 0) return 0;
    const { max } = macroToleranceBand(target, key);
    return Math.max(0, Math.round(max - consumed[key]));
  };

  return {
    calories: remaining("calories"),
    protein: remaining("protein"),
    carbs: remaining("carbs"),
    fat: remaining("fat"),
    surplus,
    overTolerance,
    consumed,
    targets,
  };
}

async function loadConsumedMacrosForDate(
  clientId: string,
  dateKey: string
): Promise<{ consumed: MealMacros; meals: DailyMealLog[] }> {
  const supabase = await createClient();
  const [meals, log] = await Promise.all([
    getDailyMealLogs(clientId, dateKey),
    supabase
      .from("daily_logs")
      .select("calories, protein, carbs, fat")
      .eq("client_id", clientId)
      .eq("date", dateKey)
      .maybeSingle(),
  ]);

  // Prefer meal-log sums (same source as the nutrition UI). daily_logs can be
  // stale or zeroed after a water-only upsert before macros sync.
  const fromMeals = sumMealMacros(meals);
  const consumed =
    meals.length > 0
      ? fromMeals
      : {
          calories: log.data?.calories ?? 0,
          protein: log.data?.protein ?? 0,
          carbs: log.data?.carbs ?? 0,
          fat: log.data?.fat ?? 0,
        };

  return { consumed, meals };
}

export async function getMacroGapForDate(
  clientId: string,
  dateKey: string,
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): Promise<MacroGap> {
  const { consumed } = await loadConsumedMacrosForDate(clientId, dateKey);
  return buildMacroGap(consumed, targets);
}

function daysAgoKey(dateKey: string, daysAgo: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

export async function getCoachContext(clientId: string, dateKey: string) {
  const supabase = await createClient();
  const weekStart = daysAgoKey(dateKey, 6);
  const ninetyStart = daysAgoKey(dateKey, 89);

  const [
    profile,
    weightHistory,
    mealLogs90,
    sessions90,
    habits,
    progressPhotoSets,
    progressPhotoContextText,
    dayMacros,
    allTimeMealCount,
    allTimeWorkoutCount,
    firstMeal,
    firstWorkout,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).single(),
    getBodyWeightHistory(clientId, 365),
    supabase
      .from("daily_meal_logs")
      .select("date, protein, calories")
      .eq("client_id", clientId)
      .gte("date", ninetyStart)
      .lte("date", dateKey),
    supabase
      .from("workout_sessions")
      .select("id, status, completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("completed_at", `${ninetyStart}T00:00:00`),
    supabase
      .from("habit_completions")
      .select("habit_id, date")
      .eq("client_id", clientId)
      .gte("date", weekStart)
      .lte("date", dateKey),
    getProgressPhotoSetsWithAnalysis(clientId, 12),
    buildProgressPhotoContextForAi(clientId),
    loadConsumedMacrosForDate(clientId, dateKey),
    supabase
      .from("daily_meal_logs")
      .select("date", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "completed"),
    supabase
      .from("daily_meal_logs")
      .select("date")
      .eq("client_id", clientId)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const p = profile.data as Profile | null;
  const targets = {
    calories: p?.target_calories ?? 2000,
    protein: p?.target_protein ?? 150,
    carbs: p?.target_carbs ?? 200,
    fat: p?.target_fat ?? 65,
  };

  const macroGap = buildMacroGap(dayMacros.consumed, targets);

  const mealRows = mealLogs90.data ?? [];
  const weekMeals = mealRows.filter((m) => m.date >= weekStart);
  const daysWithMeals = new Set(weekMeals.map((m) => m.date)).size;
  const avgProtein =
    weekMeals.reduce((s, m) => s + (m.protein ?? 0), 0) / Math.max(1, daysWithMeals);

  const weekSessions = (sessions90.data ?? []).filter((s) => {
    const d = s.completed_at?.slice(0, 10);
    return d != null && d >= weekStart;
  });

  const habitCompletions = habits.data?.length ?? 0;
  const progressPhotoSummary = summarizeProgressPhotosForCoach(progressPhotoSets);

  const progressHistory: ProgressHistorySummary = buildProgressHistorySummary({
    todayKey: dateKey,
    proteinTarget: targets.protein,
    mealRows,
    sessions: sessions90.data ?? [],
    weightHistory,
    // Row count ≈ meals logged; window stats use distinct days. Good enough for all-time scale.
    allTimeMealDays: allTimeMealCount.count ?? 0,
    allTimeWorkouts: allTimeWorkoutCount.count ?? 0,
    firstMealDate: firstMeal.data?.date ?? null,
    firstWorkoutDate: firstWorkout.data?.completed_at?.slice(0, 10) ?? null,
  });

  let dailyProgress: DailyProgressSnapshot | null = null;
  let dailyProgressContextText = "";
  try {
    dailyProgress = await loadDailyProgressSnapshot(clientId, dateKey, {
      weightHistory,
      profile: p,
      habitCompletionsLast7: habitCompletions,
    });
    dailyProgressContextText = buildDailyProgressContextForAi(dailyProgress);
  } catch {
    // Chat should still work if a secondary daily fetch fails.
    dailyProgressContextText = "";
  }

  return {
    profile: p,
    targets,
    macroGap,
    todaysMeals: dayMacros.meals,
    weightHistory,
    workoutsCompleted: weekSessions.length,
    habitCompletions,
    daysTracked: daysWithMeals,
    avgProtein: Math.round(avgProtein),
    progressPhotoSets,
    progressPhotoContextText,
    progressPhotoSummary,
    dailyProgress,
    dailyProgressContextText,
    progressHistoryText: progressHistory.promptText,
    progressHistory,
  };
}
