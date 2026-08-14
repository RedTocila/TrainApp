import { getDailyLog } from "@/lib/actions/logs";
import {
  getClientHabits,
  getHabitCompletionsForDate,
  getHabitsScheduledInRange,
} from "@/lib/actions/habits";
import { getScheduledCardiosForDate } from "@/lib/actions/user-cardio";
import { getTaskCompletionsForDate } from "@/lib/actions/task-completions";
import { getBodyWeightLog } from "@/lib/actions/weight-logs";
import {
  getWorkoutCompletionStatusForDate,
  resolveWorkoutsForDate,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { computeProgressPrediction } from "@/lib/ai/progress-prediction";
import type { ProgressPhotoCoachSummary } from "@/lib/ai/progress-photo-context";
import { cardioTaskId } from "@/lib/cardio-task-id";
import { formatGoal } from "@/lib/intake-display";
import type { BodyWeightLog, ClientHabit, Profile, ScheduledCardio } from "@/lib/types";

export type DailyProgressSnapshot = {
  dateKey: string;
  waterMl: number;
  waterGoalMl: number;
  weightTodayKg: number | null;
  weightSummary: string;
  workouts: { title: string; completed: boolean; skipped: boolean }[];
  cardio: { title: string; completed: boolean; durationMinutes: number | null }[];
  habits: { title: string; completed: boolean }[];
  habitCompletionsLast7: number;
};

function weekdayIndex(dateKey: string): number {
  // Local noon avoids DST edge cases for weekday.
  return new Date(`${dateKey}T12:00:00`).getDay();
}

function habitsForDate(
  dateKey: string,
  scheduledByDate: Record<string, ClientHabit[]>,
  allHabits: ClientHabit[]
): ClientHabit[] {
  const scheduled = scheduledByDate[dateKey];
  if (scheduled && scheduled.length > 0) return scheduled;
  const weekday = weekdayIndex(dateKey);
  return allHabits.filter((habit) => (habit.weekdays ?? []).includes(weekday));
}

export function formatWeightLogContextForAi(
  weightHistory: BodyWeightLog[],
  intakeWeightKg?: number | null
): string {
  const prediction = computeProgressPrediction(weightHistory, null);
  const lines: string[] = [];

  if (prediction.current_weight_kg != null) {
    lines.push(`Latest logged weight: ${prediction.current_weight_kg} kg`);
  } else {
    lines.push("Latest logged weight: none yet");
  }

  if (intakeWeightKg != null && Number.isFinite(intakeWeightKg)) {
    lines.push(`Intake / baseline weight: ${intakeWeightKg} kg`);
    if (prediction.current_weight_kg != null) {
      const delta =
        Math.round((prediction.current_weight_kg - intakeWeightKg) * 10) / 10;
      lines.push(
        `Change since baseline: ${delta > 0 ? "+" : ""}${delta} kg`
      );
    }
  }

  if (prediction.weekly_change_kg != null) {
    lines.push(
      `Recent trend: ${prediction.weekly_change_kg > 0 ? "+" : ""}${prediction.weekly_change_kg} kg/week`
    );
  } else {
    lines.push("Recent trend: not enough weight entries yet");
  }

  lines.push(`Weight log entries (last ~90 days): ${weightHistory.length}`);

  if (weightHistory.length > 0) {
    const recent = [...weightHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-5)
      .map((entry) => `${entry.date}: ${entry.weight_kg} kg`)
      .join("; ");
    lines.push(`Recent entries: ${recent}`);
  }

  return lines.join("\n");
}

export async function loadDailyProgressSnapshot(
  clientId: string,
  dateKey: string,
  options: {
    weightHistory: BodyWeightLog[];
    profile: Profile | null;
    habitCompletionsLast7: number;
  }
): Promise<DailyProgressSnapshot> {
  const weekAgo = new Date(dateKey);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().split("T")[0];

  const [
    dailyLog,
    weightToday,
    workouts,
    cardios,
    allHabits,
    scheduledHabits,
    habitDone,
    taskCompletions,
  ] = await Promise.all([
    getDailyLog(clientId, dateKey),
    getBodyWeightLog(clientId, dateKey),
    resolveWorkoutsForDate(clientId, dateKey),
    getScheduledCardiosForDate(clientId, dateKey),
    getClientHabits(clientId),
    getHabitsScheduledInRange(clientId, weekStart, dateKey),
    getHabitCompletionsForDate(clientId, dateKey),
    getTaskCompletionsForDate(clientId, dateKey),
  ]);

  const workoutStatus = await getWorkoutCompletionStatusForDate(
    clientId,
    dateKey,
    workouts
  );

  const waterGoalMl = options.profile?.water_goal_ml ?? 2500;
  const waterMl = dailyLog?.water_ml ?? 0;

  const workoutLines = workouts.map((workout: TodaysWorkoutInfo) => {
    const status = workoutStatus[workout.taskId];
    return {
      title: `${workout.planTitle}${workout.dayTitle ? ` — ${workout.dayTitle}` : ""}`,
      completed: Boolean(status?.completed),
      skipped: Boolean(status?.skipped),
    };
  });

  const cardioLines = cardios.map((entry: ScheduledCardio) => {
    const title = entry.client_cardio?.title ?? "Cardio";
    const durationMinutes = entry.client_cardio?.duration_minutes ?? null;
    const completed =
      taskCompletions.has(cardioTaskId(dateKey, entry.cardio_id)) ||
      taskCompletions.has(cardioTaskId(dateKey));
    return { title, completed, durationMinutes };
  });

  const todaysHabits = habitsForDate(dateKey, scheduledHabits, allHabits);
  const habitLines = todaysHabits.map((habit) => ({
    title: habit.title,
    completed: habitDone.has(habit.id),
  }));

  return {
    dateKey,
    waterMl,
    waterGoalMl,
    weightTodayKg: weightToday?.weight_kg ?? null,
    weightSummary: formatWeightLogContextForAi(
      options.weightHistory,
      options.profile?.intake_weight_kg
    ),
    workouts: workoutLines,
    cardio: cardioLines,
    habits: habitLines,
    habitCompletionsLast7: options.habitCompletionsLast7,
  };
}

function statusLabel(done: boolean, skipped?: boolean): string {
  if (skipped) return "SKIPPED";
  return done ? "DONE" : "NOT DONE";
}

export function buildDailyProgressContextForAi(
  snapshot: DailyProgressSnapshot
): string {
  const lines: string[] = [
    `TODAY'S DAILY PROGRESS (ground truth for ${snapshot.dateKey} — read before answering):`,
    `Water: ${snapshot.waterMl}/${snapshot.waterGoalMl} ml`,
  ];

  if (snapshot.weightTodayKg != null) {
    lines.push(`Weight logged today: ${snapshot.weightTodayKg} kg`);
  } else {
    lines.push("Weight logged today: none");
  }

  if (snapshot.workouts.length === 0) {
    lines.push("Workouts scheduled today: none");
  } else {
    lines.push("Workouts today:");
    for (const workout of snapshot.workouts) {
      lines.push(
        `  - ${workout.title}: ${statusLabel(workout.completed, workout.skipped)}`
      );
    }
  }

  if (snapshot.cardio.length === 0) {
    lines.push("Cardio scheduled today: none");
  } else {
    lines.push("Cardio today:");
    for (const cardio of snapshot.cardio) {
      const duration =
        cardio.durationMinutes != null ? ` (${cardio.durationMinutes} min)` : "";
      lines.push(
        `  - ${cardio.title}${duration}: ${statusLabel(cardio.completed)}`
      );
    }
  }

  if (snapshot.habits.length === 0) {
    lines.push("Habits scheduled today: none");
  } else {
    const doneCount = snapshot.habits.filter((h) => h.completed).length;
    lines.push(
      `Habits today: ${doneCount}/${snapshot.habits.length} completed`
    );
    for (const habit of snapshot.habits) {
      lines.push(`  - ${habit.title}: ${statusLabel(habit.completed)}`);
    }
  }

  lines.push(
    `Habit completion rows (last 7 days): ${snapshot.habitCompletionsLast7}`
  );
  lines.push("");
  lines.push("WEIGHT LOG:");
  lines.push(snapshot.weightSummary);

  return lines.join("\n");
}

/**
 * Goal + physique alignment rules so Alex does not default to "cut / lose weight"
 * when the client is lean or explicitly building muscle.
 */
export function buildCoachingPriorityRules(
  profile: Profile | null,
  photoSummary?: ProgressPhotoCoachSummary | null
): string {
  const goal = profile?.goal ?? null;
  const goalLabel = formatGoal(goal) ?? "not set";
  const insight = (photoSummary?.latestAlexInsight ?? "").toLowerCase();
  const focus = [
    ...(photoSummary?.focusAreas ?? []),
    ...(photoSummary?.missingAreas ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const photoText = `${insight} ${focus}`;

  const leanSignals =
    /\b(lean|visible abs|abs visible|low body fat|already lean|defined|shredded|vascular|muscular)\b/.test(
      photoText
    );
  const highFatSignals =
    /\b(overweight|excess fat|substantial fat|high body fat|soft midsection|belly fat|obese)\b/.test(
      photoText
    );
  const muscleGapSignals =
    /\b(add muscle|build muscle|undertrained|missing|size|hypertrophy|legs|back|shoulders|chest|arms)\b/.test(
      photoText
    );

  const lines = [
    "COACHING PRIORITY (mandatory — match THIS client, do not use generic cut advice):",
    `- Primary goal on file: ${goalLabel}${goal ? ` (${goal})` : ""}`,
    "- Before recommending cut / bulk / recomp / maintain, combine: primary goal + progress photos + weight trend + today's logs.",
    "- Never invent pizza, junk food, or laziness. Only roast what their actual logs/photos show.",
    "- If primary goal is gain_weight: calorie SURPLUS is mandatory. Prioritize eating enough (calorie-dense meals, extra snacks, 4–6 eating occasions), protein, and hypertrophy. NEVER push a cut, deficit, or 'eat less'. Roast skipped meals and tiny portions, not big plates.",
    "- If primary goal is build_muscle: prioritize progressive overload, protein, surplus or mild surplus / recomp as needed. Do NOT push a fat-loss cut unless photos/logs clearly show meaningful excess fat AND the client asks to get leaner.",
    "- If primary goal is lose_weight: prioritize sustainable deficit, protein, and muscle retention. Do not force a bulk.",
    "- If primary goal is stay_fit / general_health / improve_endurance: maintain performance and habits; only push a cut if they ask or photos show clear excess fat.",
  ];

  if (leanSignals && !highFatSignals) {
    lines.push(
      "- Physique signals look LEAN / low body fat (e.g. visible abs). Default coaching: add muscle, improve weak points, keep abs — NOT \"time for a cut\" or \"too much pizza.\""
    );
  }
  if (highFatSignals) {
    lines.push(
      "- Physique signals show meaningful excess fat. Fat loss can be a priority, but still respect the stated primary goal and never invent foods they did not log."
    );
  }
  if (muscleGapSignals) {
    lines.push(
      "- Photos/notes highlight muscle gaps or undertrained areas — prioritize hypertrophy there when giving training advice."
    );
  }
  if (photoSummary?.latestAlexInsight) {
    lines.push(
      `- Latest photo insight on file: ${photoSummary.latestAlexInsight}`
    );
  }

  lines.push(
    "- If goal and photos conflict, say so briefly and ask which priority they want this month — do not steamroll with a default cut narrative."
  );

  return lines.join("\n");
}
