import type { BodyWeightLog } from "@/lib/types";

export type MealDayRow = { date: string; protein: number | null; calories: number | null };
export type WorkoutSessionRow = { id: string; completed_at: string | null };

export type ProgressWindowStats = {
  days: number;
  daysWithMeals: number;
  workoutsCompleted: number;
  avgDailyProtein: number;
  avgDailyCalories: number;
  proteinTargetHitDays: number;
};

export type ProgressHistorySummary = {
  week: ProgressWindowStats;
  month: ProgressWindowStats;
  ninety: ProgressWindowStats;
  allTime: {
    daysWithMeals: number;
    workoutsCompleted: number;
    firstMealDate: string | null;
    firstWorkoutDate: string | null;
  };
  weight: {
    entries: number;
    firstKg: number | null;
    latestKg: number | null;
    deltaKg: number | null;
    firstDate: string | null;
    latestDate: string | null;
  };
  /** Compact block for the Coach Alex system prompt. */
  promptText: string;
};

function dateKeyDaysAgo(fromKey: string, daysAgo: number): string {
  const d = new Date(`${fromKey}T12:00:00`);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function aggregateMealsByDate(
  rows: MealDayRow[]
): Map<string, { protein: number; calories: number }> {
  const byDate = new Map<string, { protein: number; calories: number }>();
  for (const row of rows) {
    const prev = byDate.get(row.date) ?? { protein: 0, calories: 0 };
    prev.protein += row.protein ?? 0;
    prev.calories += row.calories ?? 0;
    byDate.set(row.date, prev);
  }
  return byDate;
}

function windowStats(
  days: number,
  fromKey: string,
  toKey: string,
  mealsByDate: Map<string, { protein: number; calories: number }>,
  workoutDates: string[],
  proteinTarget: number
): ProgressWindowStats {
  let daysWithMeals = 0;
  let proteinSum = 0;
  let caloriesSum = 0;
  let proteinTargetHitDays = 0;

  for (const [date, macros] of mealsByDate) {
    if (date < fromKey || date > toKey) continue;
    daysWithMeals += 1;
    proteinSum += macros.protein;
    caloriesSum += macros.calories;
    if (proteinTarget > 0 && macros.protein >= proteinTarget * 0.9) {
      proteinTargetHitDays += 1;
    }
  }

  const workoutsCompleted = workoutDates.filter(
    (d) => d >= fromKey && d <= toKey
  ).length;

  return {
    days,
    daysWithMeals,
    workoutsCompleted,
    avgDailyProtein: daysWithMeals > 0 ? Math.round(proteinSum / daysWithMeals) : 0,
    avgDailyCalories: daysWithMeals > 0 ? Math.round(caloriesSum / daysWithMeals) : 0,
    proteinTargetHitDays,
  };
}

function formatWindow(label: string, w: ProgressWindowStats, proteinTarget: number): string {
  if (w.daysWithMeals === 0 && w.workoutsCompleted === 0) {
    return `- ${label}: no logged meals or completed workouts in this window`;
  }
  return `- ${label}: ${w.workoutsCompleted} workouts done, ${w.daysWithMeals}/${w.days} days with meals logged, avg ${w.avgDailyProtein}g protein/day (target ${proteinTarget}g), ${w.proteinTargetHitDays} days near protein target (≥90%), avg ${w.avgDailyCalories} kcal/logged day`;
}

/**
 * Builds multi-horizon progress summaries for Coach Alex (7 / 30 / 90 days + all-time counts).
 * Keep this compact — summaries, not every raw log row.
 */
export function buildProgressHistorySummary(input: {
  todayKey: string;
  proteinTarget: number;
  mealRows: MealDayRow[];
  sessions: WorkoutSessionRow[];
  weightHistory: BodyWeightLog[];
  allTimeMealDays: number;
  allTimeWorkouts: number;
  firstMealDate: string | null;
  firstWorkoutDate: string | null;
}): ProgressHistorySummary {
  const { todayKey, proteinTarget } = input;
  const mealsByDate = aggregateMealsByDate(input.mealRows);
  const workoutDates = input.sessions
    .map((s) => (s.completed_at ? s.completed_at.slice(0, 10) : null))
    .filter((d): d is string => Boolean(d));

  const weekFrom = dateKeyDaysAgo(todayKey, 6);
  const monthFrom = dateKeyDaysAgo(todayKey, 29);
  const ninetyFrom = dateKeyDaysAgo(todayKey, 89);

  const week = windowStats(7, weekFrom, todayKey, mealsByDate, workoutDates, proteinTarget);
  const month = windowStats(30, monthFrom, todayKey, mealsByDate, workoutDates, proteinTarget);
  const ninety = windowStats(90, ninetyFrom, todayKey, mealsByDate, workoutDates, proteinTarget);

  const weights = [...input.weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const first = weights[0] ?? null;
  const latest = weights[weights.length - 1] ?? null;
  const firstKg = first ? Number(first.weight_kg) : null;
  const latestKg = latest ? Number(latest.weight_kg) : null;
  const deltaKg =
    firstKg != null && latestKg != null
      ? Math.round((latestKg - firstKg) * 10) / 10
      : null;

  const allTime = {
    daysWithMeals: input.allTimeMealDays,
    workoutsCompleted: input.allTimeWorkouts,
    firstMealDate: input.firstMealDate,
    firstWorkoutDate: input.firstWorkoutDate,
  };

  const weight = {
    entries: weights.length,
    firstKg,
    latestKg,
    deltaKg,
    firstDate: first?.date ?? null,
    latestDate: latest?.date ?? null,
  };

  const lines = [
    "LONG-TERM PROGRESS (use this for journey / consistency / trend questions — not only the last week):",
    formatWindow("Last 7 days", week, proteinTarget),
    formatWindow("Last 30 days", month, proteinTarget),
    formatWindow("Last 90 days", ninety, proteinTarget),
    `- All-time: ${allTime.workoutsCompleted} workouts completed, ${allTime.daysWithMeals} meal logs${
      allTime.firstMealDate || allTime.firstWorkoutDate
        ? ` (tracking since ~${[allTime.firstWorkoutDate, allTime.firstMealDate].filter(Boolean).sort()[0]})`
        : ""
    }`,
  ];

  if (weight.entries > 0 && weight.firstKg != null && weight.latestKg != null) {
    const sign = weight.deltaKg != null && weight.deltaKg > 0 ? "+" : "";
    lines.push(
      `- Weight log (${weight.entries} entries in range): ${weight.firstKg}kg (${weight.firstDate}) → ${weight.latestKg}kg (${weight.latestDate})${
        weight.deltaKg != null ? ` (${sign}${weight.deltaKg}kg)` : ""
      }`
    );
  } else {
    lines.push("- Weight log: no entries in range");
  }

  lines.push(
    "- When they ask how they're doing overall, cite 30/90-day and all-time numbers — not only this week. Compare windows when useful (e.g. workouts up vs last month)."
  );

  return {
    week,
    month,
    ninety,
    allTime,
    weight,
    promptText: lines.join("\n"),
  };
}
