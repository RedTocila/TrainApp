"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSubscribedMutation } from "@/lib/actions/subscriptions";
import {
  generateRecurringScheduleDates,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { formatDateKey } from "@/lib/utils";
import type { ClientHabit } from "@/lib/types";
import { findHabitSuggestionById } from "@/lib/habit-suggestions";
import {
  canCompleteHabit,
  getHabitDayStatus,
  type HabitDayStatus,
} from "@/lib/habit-utils";

function habitTaskId(habitId: string): string {
  return `habit-${habitId}`;
}

export interface SaveHabitInput {
  title: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  weekdays: number[];
  weeks: number;
  startMode: ScheduleStartMode;
}

export async function ensureHabitSchedules(clientId: string) {
  const supabase = await createClient();
  const { data: habits } = await supabase
    .from("client_habits")
    .select("*")
    .eq("client_id", clientId);

  if (!habits?.length) return;

  const { data: scheduled } = await supabase
    .from("habit_scheduled_dates")
    .select("habit_id")
    .eq("client_id", clientId);

  const scheduledHabitIds = new Set((scheduled ?? []).map((s) => s.habit_id));

  const toBackfill = habits.filter((h) => !scheduledHabitIds.has(h.id));
  if (toBackfill.length === 0) return;

  await Promise.all(
    toBackfill.map((habit) =>
      replaceHabitSchedule(supabase, habit.id, clientId, {
        title: habit.title,
        timeStart: habit.time_start,
        timeEnd: habit.time_end,
        weekdays: (habit.weekdays as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
        weeks: habit.repeat_weeks ?? 12,
        startMode: "now",
      })
    )
  );
}

export async function getClientHabits(clientId: string): Promise<ClientHabit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_habits")
    .select("*")
    .eq("client_id", clientId)
    .order("order_index");

  return (data ?? []).map(normalizeHabit);
}

function normalizeHabit(row: Record<string, unknown>): ClientHabit {
  return {
    ...(row as unknown as ClientHabit),
    weekdays: (row.weekdays as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
    repeat_weeks: (row.repeat_weeks as number) ?? 12,
  };
}

export async function getHabitCompletionsForDate(
  clientId: string,
  date: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("habit_id")
    .eq("client_id", clientId)
    .eq("date", date);

  return new Set((data ?? []).map((r) => r.habit_id));
}

export async function getHabitCompletionsInRange(
  clientId: string,
  from: string,
  to: string
): Promise<Record<string, Set<string>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("habit_id, date")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  const map: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    if (!map[row.date]) map[row.date] = new Set();
    map[row.date].add(habitTaskId(row.habit_id));
  }
  return map;
}

export async function getHabitsScheduledInRange(
  clientId: string,
  from: string,
  to: string
): Promise<Record<string, ClientHabit[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_scheduled_dates")
    .select("scheduled_date, client_habits(*)")
    .eq("client_id", clientId)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

  const map: Record<string, ClientHabit[]> = {};
  for (const row of data ?? []) {
    const habit = row.client_habits as unknown as Record<string, unknown> | null;
    if (!habit) continue;
    const date = row.scheduled_date as string;
    if (!map[date]) map[date] = [];
    map[date].push(normalizeHabit(habit));
  }
  return map;
}

async function replaceHabitSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  habitId: string,
  clientId: string,
  input: SaveHabitInput
) {
  if (input.weekdays.length === 0) {
    return { error: "Select at least one day" };
  }

  const anchor = getScheduleAnchorDate(input.startMode);
  const scheduleStart = formatDateKey(anchor);
  const dates = generateRecurringScheduleDates(
    anchor,
    input.weekdays,
    input.weeks
  );

  const { error: updateError } = await supabase
    .from("client_habits")
    .update({
      time_start: input.timeStart || null,
      time_end: input.timeEnd || null,
      weekdays: input.weekdays,
      repeat_weeks: input.weeks,
      schedule_start: scheduleStart,
    })
    .eq("id", habitId)
    .eq("client_id", clientId);

  if (updateError) return { error: updateError.message };

  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("habit_scheduled_dates")
    .delete()
    .eq("habit_id", habitId)
    .gte("scheduled_date", today);

  if (dates.length > 0) {
    const rows = dates.map((scheduled_date) => ({
      habit_id: habitId,
      client_id: clientId,
      scheduled_date,
    }));
    const { error: insertError } = await supabase
      .from("habit_scheduled_dates")
      .upsert(rows, { onConflict: "habit_id,scheduled_date" });
    if (insertError) return { error: insertError.message };
  }

  return { count: dates.length };
}

export type SaveHabitResult =
  | { error: string }
  | { data: ClientHabit | undefined };

export async function saveHabit(
  clientId: string,
  input: SaveHabitInput,
  habitId?: string
): Promise<SaveHabitResult> {
  const access = await ensureSubscribedMutation();
  if ("error" in access) return { error: access.error };

  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Habit name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id !== clientId) return { error: "Not authorized" };

  if (input.weekdays.length === 0) {
    return { error: "Select at least one day" };
  }

  if (habitId) {
    const { data: existing } = await supabase
      .from("client_habits")
      .select("id")
      .eq("id", habitId)
      .eq("client_id", clientId)
      .single();

    if (!existing) return { error: "Habit not found" };

    const { error } = await supabase
      .from("client_habits")
      .update({ title: trimmed })
      .eq("id", habitId);

    if (error) return { error: error.message };

    const scheduleResult = await replaceHabitSchedule(
      supabase,
      habitId,
      clientId,
      input
    );
    if ("error" in scheduleResult) {
      return { error: scheduleResult.error ?? "Failed to update schedule" };
    }

    revalidatePath("/dashboard");
    const { data } = await supabase
      .from("client_habits")
      .select("*")
      .eq("id", habitId)
      .single();
    return { data: data ? normalizeHabit(data) : undefined };
  }

  const { data: last } = await supabase
    .from("client_habits")
    .select("order_index")
    .eq("client_id", clientId)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { data: habit, error } = await supabase
    .from("client_habits")
    .insert({
      client_id: clientId,
      title: trimmed,
      order_index: orderIndex,
      time_start: input.timeStart || null,
      time_end: input.timeEnd || null,
      weekdays: input.weekdays,
      repeat_weeks: input.weeks,
      schedule_start: formatDateKey(getScheduleAnchorDate(input.startMode)),
    })
    .select()
    .single();

  if (error || !habit) return { error: error?.message ?? "Failed to create habit" };

  const scheduleResult = await replaceHabitSchedule(
    supabase,
    habit.id,
    clientId,
    input
  );
  if ("error" in scheduleResult) {
    return { error: scheduleResult.error ?? "Failed to update schedule" };
  }

  revalidatePath("/dashboard");
  return { data: normalizeHabit(habit) };
}

export async function deleteHabit(habitId: string) {
  const access = await ensureSubscribedMutation();
  if ("error" in access) return { error: access.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("client_habits")
    .delete()
    .eq("id", habitId)
    .eq("client_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleHabitCompletion(habitId: string, date: string) {
  const access = await ensureSubscribedMutation();
  if ("error" in access) return { error: access.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: habit } = await supabase
    .from("client_habits")
    .select("id, time_start, time_end")
    .eq("id", habitId)
    .eq("client_id", user.id)
    .single();

  if (!habit) return { error: "Habit not found" };

  const { data: existing } = await supabase
    .from("habit_completions")
    .select("habit_id")
    .eq("habit_id", habitId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return { error: "Completed habits cannot be unmarked", completed: true };
  }

  if (!canCompleteHabit(habit, date, false)) {
    const status = getHabitDayStatus(habit, date, false);
    if (status === "missed") {
      return { error: "This habit was missed — the time window has passed", completed: false };
    }
    if (status === "upcoming") {
      return { error: "You can only complete habits scheduled for today", completed: false };
    }
    return { error: "Cannot complete this habit right now", completed: false };
  }

  const { error } = await supabase.from("habit_completions").insert({
    habit_id: habitId,
    client_id: user.id,
    date,
  });
  if (error) return { error: error.message, completed: true };

  return { completed: true };
}

export async function addSuggestedHabit(
  clientId: string,
  suggestionId: string,
  profile: Parameters<typeof findHabitSuggestionById>[0]
) {
  const suggestion = findHabitSuggestionById(profile, suggestionId);
  if (!suggestion) return { error: "Suggestion not found" };

  return saveHabit(clientId, {
    title: suggestion.title,
    timeStart: suggestion.timeStart ?? null,
    timeEnd: suggestion.timeEnd ?? null,
    weekdays: suggestion.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    weeks: 12,
    startMode: "now",
  });
}

export type HabitWithStatus = ClientHabit & {
  completed: boolean;
  status: HabitDayStatus;
};

export async function getHabitsWithCompletions(
  clientId: string,
  date: string
): Promise<HabitWithStatus[]> {
  const supabase = await createClient();
  const [completedIds, scheduled] = await Promise.all([
    getHabitCompletionsForDate(clientId, date),
    supabase
      .from("habit_scheduled_dates")
      .select("client_habits(*)")
      .eq("client_id", clientId)
      .eq("scheduled_date", date),
  ]);

  const habits = (scheduled.data ?? [])
    .map((row) => row.client_habits as unknown as Record<string, unknown> | null)
    .filter((h): h is Record<string, unknown> => !!h)
    .map(normalizeHabit);

  return habits.map((habit) => {
    const isCompleted = completedIds.has(habit.id);
    return {
      ...habit,
      completed: isCompleted,
      status: getHabitDayStatus(habit, date, isCompleted),
    };
  });
}
