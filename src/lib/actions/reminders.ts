"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { getDailyLog } from "@/lib/actions/logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import {
  getClientHabits,
  getHabitCompletionsForDate,
  getHabitsScheduledInRange,
} from "@/lib/actions/habits";
import { getScheduledCardiosForDate } from "@/lib/actions/user-cardio";
import { getTaskCompletionsForDate } from "@/lib/actions/task-completions";
import {
  getWorkoutCompletionStatusForDate,
  resolveWorkoutsForDate,
} from "@/lib/actions/workout-sessions";
import { cardioTaskId } from "@/lib/cardio-task-id";
import {
  parseReminderSettings,
  type ReminderSettings,
  type ReminderType,
} from "@/lib/reminder-settings";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import { getDateKeyForTimezoneOffset } from "@/lib/utils";
import type { ClientHabit } from "@/lib/types";

export type ReminderPendingStatus = Record<ReminderType, boolean>;

function weekdayIndex(dateKey: string): number {
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

export async function getReminderSettings(): Promise<ReminderSettings> {
  const profile = await getCachedProfile();
  return parseReminderSettings(profile?.reminder_settings);
}

export async function updateReminderSettings(
  input: ReminderSettings
): Promise<{ success?: true; error?: string; settings?: ReminderSettings }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const settings = parseReminderSettings(input);

  const { data: existing } = await supabase
    .from("profiles")
    .select("reminder_settings")
    .eq("id", user.id)
    .maybeSingle();

  const { mergeReminderSettingsJson } = await import("@/lib/read-me-acks");
  const merged = mergeReminderSettingsJson(existing?.reminder_settings, settings);

  const { error } = await supabase
    .from("profiles")
    .update({ reminder_settings: merged })
    .eq("id", user.id);

  if (error) {
    if (error.message?.includes("reminder_settings")) {
      return {
        error:
          "Reminder settings are not available yet. Apply the latest database migration.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/profile");
  return { success: true, settings };
}

/**
 * Which reminder types still need attention today.
 * Types with nothing scheduled (workout/cardio/habits) return false.
 */
export async function getTodayReminderPendingStatus(
  timezoneOffsetMinutes = 0
): Promise<ReminderPendingStatus> {
  const empty: ReminderPendingStatus = {
    workout: false,
    meals: false,
    cardio: false,
    water: false,
    habits: false,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const dateKey = getDateKeyForTimezoneOffset(timezoneOffsetMinutes);
  const clientId = user.id;

  const [
    profile,
    workouts,
    workoutStatus,
    cardios,
    taskCompletions,
    dailyLog,
    mealLogs,
    allHabits,
    scheduledHabits,
    habitCompletions,
  ] = await Promise.all([
    getCachedProfile(),
    resolveWorkoutsForDate(clientId, dateKey, timezoneOffsetMinutes),
    getWorkoutCompletionStatusForDate(clientId, dateKey),
    getScheduledCardiosForDate(clientId, dateKey),
    getTaskCompletionsForDate(clientId, dateKey),
    getDailyLog(clientId, dateKey),
    getDailyMealLogs(clientId, dateKey),
    getClientHabits(clientId),
    getHabitsScheduledInRange(clientId, dateKey, dateKey),
    getHabitCompletionsForDate(clientId, dateKey),
  ]);

  const waterGoal =
    (profile?.water_goal_ml as number | null | undefined) ?? 2500;
  const waterMl = dailyLog?.water_ml ?? 0;

  const workoutPending =
    workouts.length > 0 &&
    workouts.some((workout) => {
      const status = workoutStatus[workout.taskId];
      return !status?.completed && !status?.skipped;
    });

  let cardioPending = false;
  for (const cardio of cardios) {
    const id = cardioTaskId(dateKey, cardio.id);
    const legacy = cardioTaskId(dateKey);
    if (!taskCompletions.has(id) && !taskCompletions.has(legacy)) {
      cardioPending = true;
      break;
    }
  }

  const mealsPending = (mealLogs?.length ?? 0) === 0;
  const waterPending = !waterMetDailyMinimum(waterMl, waterGoal);

  const todayHabits = habitsForDate(dateKey, scheduledHabits, allHabits);
  const completedHabitIds = new Set(habitCompletions);
  const habitsPending =
    todayHabits.length > 0 &&
    todayHabits.some((habit) => !completedHabitIds.has(habit.id));

  return {
    workout: workoutPending,
    meals: mealsPending,
    cardio: cardioPending,
    water: waterPending,
    habits: habitsPending,
  };
}
