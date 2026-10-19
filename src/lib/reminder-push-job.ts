import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { reminderPushMessage } from "@/lib/reminder-message";
import {
  cardioStillOpen,
  habitsStillOpen,
  legacyWorkoutStillOpen,
  reminderDaySplit,
  scheduledWorkoutsStillOpen,
  type WorkoutSessionRef,
} from "@/lib/reminder-pending";
import { reminderSlotForHour, tiraneClock, type ReminderSlot } from "@/lib/reminder-clock";
import { parseReminderSettings } from "@/lib/reminder-settings";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import { createPushSender, apnsConfigured, fcmConfigured, type PushPlatform } from "@/lib/push-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

type DeviceRow = {
  user_id: string;
  token: string;
  platform: PushPlatform;
};

type ProfileRow = {
  id: string;
  preferred_locale: string | null;
  water_goal_ml: number | null;
  reminder_settings: unknown;
};

const CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function selectChunks<T>(
  ids: string[],
  run: (slice: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (const slice of chunk(ids, CHUNK)) {
    const { data, error } = await run(slice);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

function groupBy<T extends { client_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.client_id);
    if (list) list.push(row);
    else map.set(row.client_id, [row]);
  }
  return map;
}

export type ReminderPushJobResult = {
  skipped?: boolean;
  reason?: string;
  dateKey: string;
  hour: number;
  slot: ReminderSlot | null;
  considered: number;
  sent: number;
  skippedComplete: number;
  failed: number;
  ios: boolean;
  android: boolean;
};

export async function runReminderPushJob(
  at: Date = new Date()
): Promise<ReminderPushJobResult> {
  const clock = tiraneClock(at);
  const slot = reminderSlotForHour(clock.hour);
  const platforms = {
    ios: apnsConfigured(),
    android: fcmConfigured(),
  };
  const base = {
    dateKey: clock.dateKey,
    hour: clock.hour,
    slot,
    considered: 0,
    sent: 0,
    skippedComplete: 0,
    failed: 0,
    ios: platforms.ios,
    android: platforms.android,
  };

  if (!slot) {
    return { ...base, skipped: true, reason: "outside-window" };
  }
  if (!base.ios && !base.android) {
    return { ...base, skipped: true, reason: "push-not-configured" };
  }

  const sender = await createPushSender();

  try {
    const admin = createAdminClient();
    const { data: deviceRows, error: deviceError } = await admin
      .from("push_devices")
      .select("user_id, token, platform");
    if (deviceError) throw new Error(deviceError.message);

    const devices = ((deviceRows ?? []) as DeviceRow[]).filter((device) =>
      sender.supports(device.platform)
    );
    const userIds = [...new Set(devices.map((device) => device.user_id))];
    if (userIds.length === 0) return base;

    const profiles = await selectChunks<ProfileRow>(userIds, (slice) =>
      admin
        .from("profiles")
        .select("id, preferred_locale, water_goal_ml, reminder_settings")
        .in("id", slice)
    );

    const enabled = profiles.filter(
      (profile) => parseReminderSettings(profile.reminder_settings).enabled
    );
    base.considered = enabled.length;
    if (enabled.length === 0) return base;

    const ids = enabled.map((profile) => profile.id);
    const dateKey = clock.dateKey;

    const [
      mealRows,
      waterRows,
      scheduledRows,
      explicitRows,
      sessionRows,
      taskRows,
      cardioRows,
      habitRows,
      habitScheduleRows,
      habitCompletionRows,
      assignmentRows,
    ] = await Promise.all([
      selectChunks<{ client_id: string }>(ids, (slice) =>
        admin
          .from("daily_meal_logs")
          .select("client_id")
          .eq("date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; water_ml: number }>(ids, (slice) =>
        admin
          .from("daily_logs")
          .select("client_id, water_ml")
          .eq("date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{
        id: string;
        client_id: string;
        plan_id: string;
        day_id: string;
      }>(ids, (slice) =>
        admin
          .from("scheduled_workouts")
          .select("id, client_id, plan_id, day_id")
          .eq("scheduled_date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string }>(ids, (slice) =>
        admin.from("scheduled_workouts").select("client_id").in("client_id", slice)
      ),
      selectChunks<{
        client_id: string;
        scheduled_workout_id: string | null;
        plan_id: string | null;
        day_id: string | null;
        status: string;
        notes: string | null;
      }>(ids, (slice) =>
        admin
          .from("workout_sessions")
          .select("client_id, scheduled_workout_id, plan_id, day_id, status, notes")
          .eq("scheduled_date", dateKey)
          .in("status", ["completed", "cancelled"])
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; task_id: string }>(ids, (slice) =>
        admin
          .from("schedule_task_completions")
          .select("client_id, task_id")
          .eq("date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; cardio_id: string }>(ids, (slice) =>
        admin
          .from("scheduled_cardio")
          .select("client_id, cardio_id")
          .eq("scheduled_date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ id: string; client_id: string; weekdays: number[] | null }>(
        ids,
        (slice) =>
          admin
            .from("client_habits")
            .select("id, client_id, weekdays")
            .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; habit_id: string }>(ids, (slice) =>
        admin
          .from("habit_scheduled_dates")
          .select("client_id, habit_id")
          .eq("scheduled_date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; habit_id: string }>(ids, (slice) =>
        admin
          .from("habit_completions")
          .select("client_id, habit_id")
          .eq("date", dateKey)
          .in("client_id", slice)
      ),
      selectChunks<{ client_id: string; plan_id: string }>(ids, (slice) =>
        admin
          .from("workout_assignments")
          .select("client_id, plan_id")
          .eq("active", true)
          .in("client_id", slice)
      ),
    ]);

    const mealsLogged = new Set(mealRows.map((row) => row.client_id));
    const waterByUser = new Map(waterRows.map((row) => [row.client_id, row.water_ml ?? 0]));
    const scheduledByUser = groupBy(scheduledRows);
    const explicitUsers = new Set(explicitRows.map((row) => row.client_id));
    const sessionsByUser = groupBy(sessionRows);
    const tasksByUser = new Map<string, Set<string>>();
    for (const row of taskRows) {
      const set = tasksByUser.get(row.client_id) ?? new Set<string>();
      set.add(row.task_id);
      tasksByUser.set(row.client_id, set);
    }
    const cardioByUser = groupBy(cardioRows);
    const habitsByUser = groupBy(habitRows);
    const habitScheduleByUser = groupBy(habitScheduleRows);
    const habitDoneByUser = new Map<string, Set<string>>();
    for (const row of habitCompletionRows) {
      const set = habitDoneByUser.get(row.client_id) ?? new Set<string>();
      set.add(row.habit_id);
      habitDoneByUser.set(row.client_id, set);
    }
    const assignmentByUser = new Map(
      assignmentRows.map((row) => [row.client_id, row.plan_id])
    );

    const legacyPlanIds = [
      ...new Set(
        ids
          .filter((id) => !explicitUsers.has(id) && assignmentByUser.has(id))
          .map((id) => assignmentByUser.get(id) as string)
      ),
    ];
    const dayRows =
      legacyPlanIds.length === 0
        ? []
        : await selectChunks<{ id: string; plan_id: string; day_index: number }>(
            legacyPlanIds,
            (slice) =>
              admin
                .from("workout_days")
                .select("id, plan_id, day_index")
                .in("plan_id", slice)
          );
    const daysByPlan = new Map<string, { id: string; day_index: number }[]>();
    for (const day of dayRows) {
      const list = daysByPlan.get(day.plan_id) ?? [];
      list.push(day);
      daysByPlan.set(day.plan_id, list);
    }

    const devicesByUser = new Map<string, DeviceRow[]>();
    for (const device of devices) {
      const list = devicesByUser.get(device.user_id) ?? [];
      list.push(device);
      devicesByUser.set(device.user_id, list);
    }

    const deadTokens: string[] = [];

    for (const profile of enabled) {
      const settings = parseReminderSettings(profile.reminder_settings);
      const sessions: WorkoutSessionRef[] = (sessionsByUser.get(profile.id) ?? []).map(
        (session) => ({
          scheduledWorkoutId: session.scheduled_workout_id,
          planId: session.plan_id,
          dayId: session.day_id,
          status: session.status,
          notes: session.notes,
        })
      );
      const taskIds = tasksByUser.get(profile.id) ?? new Set<string>();
      const scheduled = (scheduledByUser.get(profile.id) ?? []).map((row) => ({
        id: row.id,
        planId: row.plan_id,
        dayId: row.day_id,
      }));

      let workoutDue = scheduled.length > 0;
      let workoutsOpen = workoutDue
        ? scheduledWorkoutsStillOpen({
            dateKey,
            scheduled,
            sessions,
            taskIds,
          })
        : false;
      if (!workoutDue && !explicitUsers.has(profile.id)) {
        const planId = assignmentByUser.get(profile.id);
        const days = planId
          ? [...(daysByPlan.get(planId) ?? [])].sort((a, b) => a.day_index - b.day_index)
          : [];
        if (planId && days.length > 0) {
          workoutDue = true;
          const day = days[clock.weekday % days.length];
          workoutsOpen = legacyWorkoutStillOpen({
            dateKey,
            planId,
            dayId: day.id,
            sessions,
            taskIds,
          });
        }
      }

      const scheduledHabits = habitScheduleByUser.get(profile.id) ?? [];
      const allHabits = habitsByUser.get(profile.id) ?? [];
      const habitIds =
        scheduledHabits.length > 0
          ? scheduledHabits.map((row) => row.habit_id)
          : allHabits
              .filter((habit) => (habit.weekdays ?? [0, 1, 2, 3, 4, 5, 6]).includes(clock.weekday))
              .map((habit) => habit.id);
      const cardioIds = (cardioByUser.get(profile.id) ?? []).map((row) => row.cardio_id);
      const waterMl = waterByUser.get(profile.id) ?? 0;
      const waterGoalMl = profile.water_goal_ml ?? 2500;

      const progress = reminderDaySplit({
        settings,
        due: {
          workout: workoutDue,
          meals: true,
          cardio: cardioIds.length > 0,
          water: true,
          habits: habitIds.length > 0,
        },
        open: {
          workout: workoutsOpen,
          meals: !mealsLogged.has(profile.id),
          cardio: cardioStillOpen({ dateKey, cardioIds, taskIds }),
          water: !waterMetDailyMinimum(waterMl, waterGoalMl),
          habits: habitsStillOpen({
            habitIds,
            completedHabitIds: habitDoneByUser.get(profile.id) ?? new Set(),
          }),
        },
      });

      if (progress.open.length === 0 || (slot === 4 && progress.done.length > 0)) {
        base.skippedComplete += 1;
        continue;
      }

      const userDevices = devicesByUser.get(profile.id) ?? [];
      if (userDevices.length === 0) continue;

      const { error: claimError } = await admin.from("reminder_push_sends").insert({
        user_id: profile.id,
        date_key: dateKey,
        slot,
        types: progress.open,
      });
      if (claimError) {
        if (claimError.code === "23505") continue;
        throw new Error(claimError.message);
      }

      const message = reminderPushMessage({
        open: progress.open,
        done: progress.done,
        locale: parseCheckoutLocale(profile.preferred_locale),
        slot,
        seed: `${profile.id}:${dateKey}:${slot}`,
      });
      if (!message) {
        base.skippedComplete += 1;
        await admin
          .from("reminder_push_sends")
          .delete()
          .eq("user_id", profile.id)
          .eq("date_key", dateKey)
          .eq("slot", slot);
        continue;
      }
      let delivered = false;
      for (const device of userDevices) {
        try {
          const result = await sender.send(device.platform, device.token, message);
          if (result.ok) delivered = true;
          else if (result.invalidToken) deadTokens.push(device.token);
        } catch {
          // try the next device; the slot is released if none succeed
        }
      }

      if (!delivered) {
        base.failed += 1;
        await admin
          .from("reminder_push_sends")
          .delete()
          .eq("user_id", profile.id)
          .eq("date_key", dateKey)
          .eq("slot", slot);
        continue;
      }
      base.sent += 1;
    }

    if (deadTokens.length > 0) {
      await admin.from("push_devices").delete().in("token", deadTokens);
    }

    return base;
  } finally {
    sender.close();
  }
}
