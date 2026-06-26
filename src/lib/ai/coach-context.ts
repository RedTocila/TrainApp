import { createClient } from "@/lib/supabase/server";
import { getBodyWeightHistory } from "@/lib/actions/weight-logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import type { MacroGap } from "@/lib/ai/types";
import type { Profile } from "@/lib/types";
import {
  dailyMacroSurplus,
  dailyMacrosExceededUpperLimit,
  macroToleranceBand,
} from "@/lib/macro-targets";
import type { MealMacros } from "@/lib/meal-utils";

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

  const fromMeals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const consumed = {
    calories: log.data?.calories ?? fromMeals.calories,
    protein: log.data?.protein ?? fromMeals.protein,
    carbs: log.data?.carbs ?? fromMeals.carbs,
    fat: log.data?.fat ?? fromMeals.fat,
  };

  return buildMacroGap(consumed, targets);
}

export async function getCoachContext(clientId: string, dateKey: string) {
  const supabase = await createClient();
  const weekAgo = new Date(dateKey);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().split("T")[0];

  const [profile, weightHistory, mealLogs, sessions, habits] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).single(),
    getBodyWeightHistory(clientId, 90),
    supabase
      .from("daily_meal_logs")
      .select("date, protein, calories")
      .eq("client_id", clientId)
      .gte("date", weekStart)
      .lte("date", dateKey),
    supabase
      .from("workout_sessions")
      .select("id, status, completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("completed_at", `${weekStart}T00:00:00`),
    supabase
      .from("habit_completions")
      .select("habit_id, date")
      .eq("client_id", clientId)
      .gte("date", weekStart)
      .lte("date", dateKey),
  ]);

  const p = profile.data as Profile | null;
  const targets = {
    calories: p?.target_calories ?? 2000,
    protein: p?.target_protein ?? 150,
    carbs: p?.target_carbs ?? 200,
    fat: p?.target_fat ?? 65,
  };

  const macroGap = await getMacroGapForDate(clientId, dateKey, targets);

  const daysWithMeals = new Set((mealLogs.data ?? []).map((m) => m.date)).size;
  const avgProtein =
    (mealLogs.data ?? []).reduce((s, m) => s + (m.protein ?? 0), 0) /
    Math.max(1, daysWithMeals);

  return {
    profile: p,
    targets,
    macroGap,
    weightHistory,
    workoutsCompleted: sessions.data?.length ?? 0,
    habitCompletions: habits.data?.length ?? 0,
    daysTracked: daysWithMeals,
    avgProtein: Math.round(avgProtein),
  };
}
