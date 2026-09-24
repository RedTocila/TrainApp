"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureManualPlanCreation, ensurePlanMutationAccess } from "@/lib/actions/usage-limits";
import { generateRecurringScheduleDates, inferScheduleFromSessions } from "@/lib/schedule-utils";
import { WORKOUT_DAY_WITH_EXERCISES, WORKOUT_PLAN_LIST_COLUMNS, WORKOUT_PLAN_WEEK_LIST_COLUMNS } from "@/lib/db-selects";
import { isExtraWorkoutKind, isMainWorkoutKind } from "@/lib/hiit";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import type { ScheduledWorkout, WorkoutDay, Exercise } from "@/lib/types";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

async function requireMutationAdmin() {
  const access = await ensurePlanMutationAccess();
  if ("error" in access) throw new Error(access.error);
  return { admin: access.admin, userId: access.userId };
}

/** Wipe every scheduled workout on the given dates for this client. */
async function clearScheduledWorkoutsOnDates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  dateKeys: string[]
) {
  if (dateKeys.length === 0) return;
  const unique = [...new Set(dateKeys)];
  // PostgREST `.in()` stays reliable in modest chunks.
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await admin
      .from("scheduled_workouts")
      .delete()
      .eq("client_id", userId)
      .in("scheduled_date", chunk);
    if (error) throw new Error(error.message);
  }
}

export async function createPersonalWorkoutPlan(
  title: string,
  description?: string,
  folderId?: string | null
) {
  const access = await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  const resolvedFolderId =
    folderId && folderId !== UNCATEGORIZED_FOLDER_ID ? folderId : null;

  if (resolvedFolderId) {
    const { data: folder } = await admin
      .from("workout_folders")
      .select("id")
      .eq("id", resolvedFolderId)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data, error } = await admin
    .from("workout_plans")
    .insert({
      title,
      description: description ?? null,
      created_by: userId,
      is_personal: true,
      folder_id: resolvedFolderId,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  if (resolvedFolderId) {
    revalidatePath(`/dashboard/workout/folder/${resolvedFolderId}`);
  }
  return { data };
}

export async function updatePersonalWorkoutPlan(
  planId: string,
  title: string,
  description?: string
) {
  const access = await ensurePlanMutationAccess();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  const trimmed = title.trim();
  if (!trimmed) return { error: "Title is required" };

  const { data: existing } = await admin
    .from("workout_plans")
    .select("id, folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!existing) return { error: "Workout not found" };

  const { error } = await admin
    .from("workout_plans")
    .update({
      title: trimmed,
      description: description?.trim() || null,
    })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  revalidatePath(`/dashboard/workout/${planId}`);
  if (existing.folder_id) {
    revalidatePath(`/dashboard/workout/folder/${existing.folder_id}`);
  }
  return { success: true };
}

export async function getPersonalWorkoutPlans(folderId?: string) {
  const { supabase, userId } = await requireUserId();

  let query = supabase
    .from("workout_plans")
    .select(WORKOUT_PLAN_LIST_COLUMNS)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (folderId === UNCATEGORIZED_FOLDER_ID) {
    query = query.is("folder_id", null);
  } else if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  const { data } = await query.order("created_at", { ascending: false });

  return (data ?? []).map((plan) => ({
    ...plan,
    kind: ((plan.kind as string | null) ?? "strength") as import("@/lib/hiit").WorkoutPlanKind,
    hiit_config: plan.hiit_config ?? null,
    week_config: null,
  }));
}

export async function getPersonalWorkoutPlanWithDetails(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("workout_plans")
    .select(WORKOUT_PLAN_LIST_COLUMNS)
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { plan: null, days: [] };

  const { data: days } = await supabase
    .from("workout_days")
    .select(
      "id, plan_id, day_index, title, exercises(id, day_id, name, sets, reps, rest_seconds, notes, image_url, video_url, order_index)"
    )
    .eq("plan_id", planId)
    .order("day_index");

  return {
    plan: {
      ...plan,
      kind: ((plan.kind as string | null) ?? "strength") as import("@/lib/hiit").WorkoutPlanKind,
      hiit_config: plan.hiit_config ?? null,
      week_config: null,
    },
    days: days ?? [],
  };
}

export async function deletePersonalWorkoutPlan(planId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { error } = await admin
    .from("workout_plans")
    .delete()
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/plans");
  return { success: true };
}

export async function assignPersonalWorkoutPlan(planId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: plan } = await admin
    .from("workout_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Plan not found" };

  await admin
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", userId);

  const { error } = await admin.from("workout_assignments").insert({
    client_id: userId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { success: true };
}

export async function scheduleWorkout(
  scheduledDate: string,
  planId: string,
  dayId: string
) {
  return scheduleWorkoutSeries({
    startDate: scheduledDate,
    weekdays: [new Date(scheduledDate + "T12:00:00").getDay()],
    weeks: 1,
    planId,
    dayId,
  });
}

export async function scheduleWorkoutSeries({
  startDate,
  weekdays,
  weeks,
  planId,
  dayId,
}: {
  startDate: string;
  weekdays: number[];
  weeks: number;
  planId: string;
  dayId: string;
}) {
  const { admin, userId } = await requireMutationAdmin();

  if (!weekdays.length) return { error: "Select at least one day of the week" };
  if (weeks < 1 || weeks > 52) return { error: "Weeks must be between 1 and 52" };

  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, is_personal, created_by")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const isOwnPersonal = plan.is_personal && plan.created_by === userId;
  let canSchedule = isOwnPersonal;

  if (!canSchedule) {
    const { data: assignment } = await admin
      .from("workout_assignments")
      .select("id")
      .eq("client_id", userId)
      .eq("plan_id", planId)
      .eq("active", true)
      .maybeSingle();
    canSchedule = !!assignment;
  }

  if (!canSchedule) return { error: "You cannot schedule this workout" };

  const { data: day } = await admin
    .from("workout_days")
    .select("id")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .single();

  if (!day) return { error: "Workout day not found" };

  const dates = generateRecurringScheduleDates(
    new Date(startDate + "T12:00:00"),
    weekdays,
    weeks
  );

  if (dates.length === 0) {
    return { error: "No dates to schedule. Check your day and week selections." };
  }

  // Replace anything already on these calendar days.
  try {
    await clearScheduledWorkoutsOnDates(admin, userId, dates);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not clear existing schedule",
    };
  }

  const rows = dates.map((scheduledDate) => ({
    client_id: userId,
    scheduled_date: scheduledDate,
    plan_id: planId,
    day_id: dayId,
  }));

  for (const row of rows) {
    const { error: insertError } = await admin.from("scheduled_workouts").insert({
      ...row,
      order_index: 0,
    });

    if (insertError) return { error: insertError.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  return { success: true, count: dates.length };
}

export async function getPlanScheduleForEdit(planId: string) {
  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date, day_id")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .gte("scheduled_date", today)
    .order("scheduled_date");

  if (!data?.length) return null;

  return inferScheduleFromSessions(data);
}

export async function clearPlanSchedule(planId: string) {
  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .gte("scheduled_date", today);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  return { success: true };
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isOneOffCalendarPlan(description: string | null | undefined): boolean {
  return (description ?? "").toLowerCase().includes("one-off session");
}

function planKindFromJoin(
  plans: { kind?: string | null } | { kind?: string | null }[] | null | undefined
): string {
  const row = Array.isArray(plans) ? plans[0] : plans;
  return (row?.kind as string | null) ?? "strength";
}

/** Compact stacked view of upcoming calendar sessions (not one row per date). */
export async function getUpcomingWorkoutScheduleSummary(): Promise<{
  total: number;
  text: string;
}> {
  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, scheduled_date, plan_id, workout_plans(id, title, kind, description)"
    )
    .eq("client_id", userId)
    .gte("scheduled_date", today)
    .order("scheduled_date");

  if (error) {
    return { total: 0, text: `Could not load schedule: ${error.message}` };
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { total: 0, text: "No upcoming scheduled workouts." };
  }

  const byWeekday = new Map<number, number>();
  const byKind = new Map<string, number>();
  const byTitle = new Map<string, number>();
  const libraryByPlan = new Map<
    string,
    { title: string; kind: string; count: number }
  >();
  let oneOffCount = 0;
  let from = rows[0]!.scheduled_date as string;
  let to = rows[0]!.scheduled_date as string;

  for (const row of rows) {
    const date = row.scheduled_date as string;
    if (date < from) from = date;
    if (date > to) to = date;
    const dow = new Date(date + "T12:00:00").getDay();
    byWeekday.set(dow, (byWeekday.get(dow) ?? 0) + 1);

    const plan = Array.isArray(row.workout_plans)
      ? row.workout_plans[0]
      : row.workout_plans;
    const kind = (plan?.kind as string | null) ?? "strength";
    const title = (plan?.title as string | null) ?? "Workout";
    const description = plan?.description as string | null;
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    byTitle.set(title, (byTitle.get(title) ?? 0) + 1);

    if (isOneOffCalendarPlan(description)) {
      oneOffCount += 1;
    } else if (row.plan_id) {
      const existing = libraryByPlan.get(row.plan_id as string);
      if (existing) existing.count += 1;
      else {
        libraryByPlan.set(row.plan_id as string, {
          title,
          kind,
          count: 1,
        });
      }
    }
  }

  const weekdayLine = [...byWeekday.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => `${WEEKDAY_SHORT[d]}×${n}`)
    .join(", ");
  const kindLine = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}×${n}`)
    .join(", ");
  const topTitles = [...byTitle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t, n]) => (n > 1 ? `"${t}"×${n}` : `"${t}"`))
    .join(", ");

  const libraryLines = [...libraryByPlan.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(
      ([id, p]) =>
        `- Library “${p.title}” [${p.kind}] id=${id} · ${p.count} upcoming`
    );

  const lines = [
    "Upcoming workouts (STACKED — do NOT list individual dates to the client):",
    `- Total: ${rows.length} sessions · ${from} → ${to}`,
    `- Weekdays: ${weekdayLine}`,
    `- Types: ${kindLine}`,
    oneOffCount > 0
      ? `- Calendar one-offs (AI day sessions): ${oneOffCount} — clear with clear_workout_schedule, never delete one-by-one`
      : null,
    libraryLines.length
      ? `Library plans with schedule:\n${libraryLines.join("\n")}`
      : "- No multi-use library plans on the calendar (mostly one-off day sessions).",
    topTitles ? `- Top titles: ${topTitles}` : null,
    "If they want to clear: ask which — all upcoming, specific weekdays (0=Sun…6=Sat), kinds (warmup/stretch/strength/hiit), or one library plan_id. Then call clear_workout_schedule once with that scope.",
  ].filter(Boolean);

  return { total: rows.length, text: lines.join("\n") };
}

/** Clear upcoming sessions by stacked scope (all / plan / weekdays / kinds). */
export async function clearUpcomingWorkoutSchedule(options: {
  planId?: string | null;
  clearAll?: boolean;
  weekdays?: number[];
  kinds?: string[];
}): Promise<{ success: true; removed: number } | { error: string }> {
  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().split("T")[0];
  const planId = options.planId?.trim() || null;
  const weekdays = (options.weekdays ?? []).filter(
    (n) => Number.isFinite(n) && n >= 0 && n <= 6
  );
  const kinds = (options.kinds ?? [])
    .map((k) => String(k).toLowerCase())
    .filter(Boolean);
  const clearAll = options.clearAll === true;

  if (!planId && !clearAll && weekdays.length === 0 && kinds.length === 0) {
    return {
      error:
        "Specify clear_all, plan_id, weekdays, and/or kinds before clearing.",
    };
  }

  if (planId && !weekdays.length && !kinds.length && !clearAll) {
    const result = await clearPlanSchedule(planId);
    if (result.error) return { error: result.error };
    return { success: true, removed: -1 };
  }

  const { data, error } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date, plan_id, workout_plans(kind)")
    .eq("client_id", userId)
    .gte("scheduled_date", today);

  if (error) return { error: error.message };

  let rows = data ?? [];
  if (planId) {
    rows = rows.filter((row) => row.plan_id === planId);
  }
  if (weekdays.length > 0) {
    const set = new Set(weekdays);
    rows = rows.filter((row) =>
      set.has(new Date(`${row.scheduled_date}T12:00:00`).getDay())
    );
  }
  if (kinds.length > 0) {
    const set = new Set(kinds);
    rows = rows.filter((row) =>
      set.has(planKindFromJoin(row.workout_plans).toLowerCase())
    );
  }

  const ids = rows.map((row) => row.id as string);
  if (ids.length === 0) {
    return { success: true, removed: 0 };
  }

  const { error: deleteError } = await supabase
    .from("scheduled_workouts")
    .delete()
    .in("id", ids)
    .eq("client_id", userId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  if (planId) revalidatePath(`/dashboard/workout/${planId}/edit`);
  return { success: true, removed: ids.length };
}

export async function replacePlanSchedule({
  startDate,
  weekdays,
  weeks,
  planId,
  dayId,
}: {
  startDate: string;
  weekdays: number[];
  weeks: number;
  planId: string;
  dayId: string;
}) {
  const cleared = await clearPlanSchedule(planId);
  if (cleared.error) return cleared;
  return scheduleWorkoutSeries({ startDate, weekdays, weeks, planId, dayId });
}

export async function unscheduleWorkout(
  scheduledDate: string,
  scheduledWorkoutId?: string | string[]
) {
  const { supabase, userId } = await requireUserId();

  let query = supabase
    .from("scheduled_workouts")
    .delete()
    .eq("client_id", userId);

  if (scheduledWorkoutId) {
    const ids = Array.isArray(scheduledWorkoutId)
      ? scheduledWorkoutId
      : [scheduledWorkoutId];
    if (ids.length === 0) return { error: "No workouts selected" };
    query = ids.length === 1 ? query.eq("id", ids[0]) : query.in("id", ids);
  } else {
    query = query.eq("scheduled_date", scheduledDate);
  }

  const { error } = await query;

  if (error) return { error: error.message };
  // Don't block the client on a full dashboard RSC refresh.
  after(() => {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
  });
  return { success: true };
}

export async function addWorkoutToDay(
  scheduledDate: string,
  planId: string,
  dayId: string
) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, is_personal, created_by, kind")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const isOwnPersonal = plan.is_personal && plan.created_by === userId;
  let canSchedule = isOwnPersonal;

  if (!canSchedule) {
    const { data: assignment } = await admin
      .from("workout_assignments")
      .select("id")
      .eq("client_id", userId)
      .eq("plan_id", planId)
      .eq("active", true)
      .maybeSingle();
    canSchedule = !!assignment;
  }

  if (!canSchedule) return { error: "You cannot schedule this workout" };

  const { data: day } = await admin
    .from("workout_days")
    .select("id")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .single();

  if (!day) return { error: "Workout day not found" };

  const { data: existingRows } = await admin
    .from("scheduled_workouts")
    .select("id, plan_id, day_id, order_index, workout_plans(kind)")
    .eq("client_id", userId)
    .eq("scheduled_date", scheduledDate)
    .order("order_index", { ascending: false });

  const existing = existingRows ?? [];
  const duplicate = existing.find(
    (row) => row.plan_id === planId && row.day_id === dayId
  );
  if (duplicate) {
    return { data: duplicate, alreadyScheduled: true as const };
  }

  const addingExtra = isExtraWorkoutKind(plan.kind as string | null);
  if (addingExtra) {
    const hasSameExtra = existing.some((row) => {
      const kind = Array.isArray(row.workout_plans)
        ? row.workout_plans[0]?.kind
        : (row.workout_plans as { kind?: string } | null)?.kind;
      return kind === plan.kind;
    });
    if (hasSameExtra) {
      return {
        error:
          plan.kind === "warmup"
            ? "This day already has a warm-up. You can still add a main workout or stretching."
            : "This day already has a stretching session. You can still add a warm-up or main workout.",
      };
    }
  } else {
    const hasMain = existing.some((row) => {
      const kind = Array.isArray(row.workout_plans)
        ? row.workout_plans[0]?.kind
        : (row.workout_plans as { kind?: string } | null)?.kind;
      return isMainWorkoutKind(kind);
    });
    if (hasMain) {
      return {
        error:
          "This day already has a main workout. You can still add a warmup or stretching session.",
      };
    }
  }

  // Warm-up → main → stretch visual order on the day.
  const kindOrder =
    plan.kind === "warmup" ? 0 : plan.kind === "stretch" ? 200 : 100;
  const sameBand = existing.filter((row) => {
    const kind = Array.isArray(row.workout_plans)
      ? row.workout_plans[0]?.kind
      : (row.workout_plans as { kind?: string } | null)?.kind;
    const rowOrder =
      kind === "warmup" ? 0 : kind === "stretch" ? 200 : 100;
    return rowOrder === kindOrder;
  });
  const orderIndex =
    kindOrder +
    (sameBand.length > 0
      ? Math.max(...sameBand.map((row) => (row.order_index ?? kindOrder) % 100)) + 1
      : 0);

  const { data, error } = await admin
    .from("scheduled_workouts")
    .insert({
      client_id: userId,
      scheduled_date: scheduledDate,
      plan_id: planId,
      day_id: dayId,
      order_index: orderIndex,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { data, alreadyScheduled: false as const };
}

/** Scheduled day entries for the current user on a date (library picker). */
export async function getScheduledDayEntriesForDate(scheduledDate: string) {
  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("scheduled_workouts")
    .select("id, day_id")
    .eq("client_id", userId)
    .eq("scheduled_date", scheduledDate);

  return (data ?? [])
    .map((row) => ({
      scheduledWorkoutId: row.id as string,
      dayId: row.day_id as string | null,
    }))
    .filter(
      (row): row is { scheduledWorkoutId: string; dayId: string } =>
        Boolean(row.scheduledWorkoutId && row.dayId)
    );
}

/** @deprecated Prefer getScheduledDayEntriesForDate */
export async function getScheduledDayIdsForDate(scheduledDate: string) {
  const entries = await getScheduledDayEntriesForDate(scheduledDate);
  return entries.map((entry) => entry.dayId);
}

export async function unscheduleWorkoutDay(
  scheduledDate: string,
  dayId: string
) {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("client_id", userId)
    .eq("scheduled_date", scheduledDate)
    .eq("day_id", dayId);

  if (error) return { error: error.message };
  after(() => {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
  });
  return { success: true };
}

export async function getScheduledWorkoutsInRange(from: string, to: string) {
  const { supabase, userId } = await requireUserId();

  const { data } = await supabase
    .from("scheduled_workouts")
    .select(
      "*, workout_plans(title, kind), workout_days(title, day_index, exercises(id, name, sets, reps, order_index))"
    )
    .eq("client_id", userId)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date")
    .order("order_index")
    .order("created_at");

  return (data ?? []) as ScheduledWorkout[];
}

export interface WorkoutFolderOverview {
  id: string;
  name: string;
  workoutCount: number;
  created_at?: string;
}

export async function getWorkoutFoldersOverview(): Promise<WorkoutFolderOverview[]> {
  const { supabase, userId } = await requireUserId();

  const [{ data: folders }, { data: plans }] = await Promise.all([
    supabase
      .from("workout_folders")
      .select("id, name, created_at")
      .eq("client_id", userId)
      .order("created_at"),
    supabase
      .from("workout_plans")
      .select("folder_id")
      .eq("created_by", userId)
      .eq("is_personal", true),
  ]);

  const countByFolder = new Map<string | null, number>();
  for (const plan of plans ?? []) {
    const key = plan.folder_id as string | null;
    countByFolder.set(key, (countByFolder.get(key) ?? 0) + 1);
  }

  const result: WorkoutFolderOverview[] = (folders ?? []).map((folder) => ({
    id: folder.id,
    name: folder.name,
    workoutCount: countByFolder.get(folder.id) ?? 0,
    created_at: folder.created_at,
  }));

  return result;
}

export async function getWorkoutFolderMeta(folderId: string) {
  if (folderId === UNCATEGORIZED_FOLDER_ID) return null;

  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("workout_folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("client_id", userId)
    .single();

  if (!data) return null;
  return data;
}

export async function createWorkoutFolder(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required" };

  const { admin, userId } = await requireMutationAdmin();
  const { data, error } = await admin
    .from("workout_folders")
    .insert({ client_id: userId, name: trimmed })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  return { data };
}

export async function renameWorkoutFolder(folderId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required" };

  const { admin, userId } = await requireMutationAdmin();
  const { error } = await admin
    .from("workout_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .eq("client_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/folder/${folderId}`);
  return { success: true };
}

export async function deleteWorkoutFolder(folderId: string) {
  const { admin, userId } = await requireMutationAdmin();
  const { error } = await admin
    .from("workout_folders")
    .delete()
    .eq("id", folderId)
    .eq("client_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  return { success: true };
}

export async function getWorkoutFoldersForMove(): Promise<{ id: string; name: string }[]> {
  const { supabase, userId } = await requireUserId();

  const { data: folders } = await supabase
    .from("workout_folders")
    .select("id, name")
    .eq("client_id", userId)
    .order("created_at");

  return (folders ?? []).map((folder) => ({ id: folder.id, name: folder.name }));
}

export async function moveWorkoutToFolder(planId: string, targetFolderId: string) {
  const { admin, userId } = await requireMutationAdmin();
  const resolvedTarget =
    targetFolderId === UNCATEGORIZED_FOLDER_ID ? null : targetFolderId;

  if (resolvedTarget) {
    const { data: folder } = await admin
      .from("workout_folders")
      .select("id")
      .eq("id", resolvedTarget)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Workout not found" };

  const oldFolderId = plan.folder_id as string | null;

  if (oldFolderId === resolvedTarget) {
    return { success: true };
  }

  const { error } = await admin
    .from("workout_plans")
    .update({ folder_id: resolvedTarget })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  if (oldFolderId) {
    revalidatePath(`/dashboard/workout/folder/${oldFolderId}`);
  }
  if (resolvedTarget) {
    revalidatePath(`/dashboard/workout/folder/${resolvedTarget}`);
  }

  return { success: true };
}

export interface WorkoutPickItem {
  id: string;
  title: string;
  description: string | null;
  currentFolderName: string;
}

export async function getWorkoutsAvailableForFolder(
  targetFolderId: string
): Promise<WorkoutPickItem[]> {
  const { supabase, userId } = await requireUserId();
  const folderOptions = await getWorkoutFoldersForMove();
  const folderNameById = new Map(folderOptions.map((f) => [f.id, f.name]));
  const resolvedTarget =
    targetFolderId === UNCATEGORIZED_FOLDER_ID ? null : targetFolderId;

  const { data: plans } = await supabase
    .from("workout_plans")
    .select("id, title, description, folder_id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .order("title");

  return (plans ?? [])
    .filter((plan) => (plan.folder_id as string | null) !== resolvedTarget)
    .map((plan) => {
      const folderKey =
        (plan.folder_id as string | null) ?? UNCATEGORIZED_FOLDER_ID;
      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        currentFolderName: folderNameById.get(folderKey) ?? "—",
      };
    });
}

export interface PersonalWorkoutListItem {
  plan: NonNullable<Awaited<ReturnType<typeof getPersonalWorkoutPlanWithDetails>>["plan"]>;
  days: WorkoutDay[];
  nextSession: string | null;
  upcomingCount: number;
  scheduleSummary: string;
}

export async function getPersonalWorkoutsWithSchedules(
  folderId?: string
): Promise<PersonalWorkoutListItem[]> {
  const { supabase, userId } = await requireUserId();
  const plans = (await getPersonalWorkoutPlans(folderId)).filter(
    (plan) => plan.kind === "strength" || plan.kind === "hiit"
  );
  if (plans.length === 0) return [];

  const today = new Date().toISOString().split("T")[0];
  const planIds = plans.map((plan) => plan.id);

  const [{ data: upcoming }, { data: days }] = await Promise.all([
    supabase
      .from("scheduled_workouts")
      .select("scheduled_date, plan_id")
      .eq("client_id", userId)
      .gte("scheduled_date", today)
      .order("scheduled_date"),
    supabase
      .from("workout_days")
      .select(WORKOUT_DAY_WITH_EXERCISES)
      .in("plan_id", planIds)
      .order("day_index"),
  ]);

  const daysByPlan = new Map<string, WorkoutDay[]>();
  for (const day of days ?? []) {
    const list = daysByPlan.get(day.plan_id) ?? [];
    list.push(day as WorkoutDay);
    daysByPlan.set(day.plan_id, list);
  }

  const sessionsByPlan = new Map<string, string[]>();
  for (const row of upcoming ?? []) {
    const list = sessionsByPlan.get(row.plan_id) ?? [];
    list.push(row.scheduled_date);
    sessionsByPlan.set(row.plan_id, list);
  }

  return plans
    .map((plan) => {
      const planDays = daysByPlan.get(plan.id) ?? [];
      const sessions = sessionsByPlan.get(plan.id) ?? [];
      const nextSession = sessions[0] ?? null;
      const upcomingCount = sessions.length;

      let scheduleSummary = "Not scheduled";
      if (nextSession) {
        const nextLabel = new Date(nextSession + "T12:00:00").toLocaleDateString(
          "en-US",
          { weekday: "short", month: "short", day: "numeric" }
        );
        scheduleSummary =
          upcomingCount === 1
            ? `Next: ${nextLabel}`
            : `Next: ${nextLabel} · ${upcomingCount} sessions`;
      }

      return {
        plan,
        days: planDays,
        nextSession,
        upcomingCount,
        scheduleSummary,
      };
    })
    // Multi-day groups belong under Plans (week templates), not Workouts.
    .filter((item) => item.days.length <= 1);
}

export interface PersonalWeekPlanListItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: string | null;
  config: import("@/lib/week-plan").WeekPlanConfig;
}

export async function getPersonalWeekPlans(): Promise<PersonalWeekPlanListItem[]> {
  const { supabase, userId } = await requireUserId();
  const { normalizeWeekPlanConfig } = await import("@/lib/week-plan");

  // Legacy multi-day strength blobs → week templates under Plans.
  await promoteOrphanMultiDayStrengthPlans();

  const { data } = await supabase
    .from("workout_plans")
    .select(WORKOUT_PLAN_WEEK_LIST_COLUMNS)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week")
    .order("created_at", { ascending: false });

  return (data ?? []).flatMap((plan) => {
    const config = normalizeWeekPlanConfig(plan.week_config);
    if (!config) return [];
    return [
      {
        id: plan.id as string,
        title: (plan.title as string) || "Week plan",
        description: (plan.description as string | null) ?? null,
        createdAt: (plan.created_at as string | null) ?? null,
        config,
      },
    ];
  });
}

/**
 * Convert legacy multi-day strength plans (old "Hypertrophy Split" style) into
 * Plans week templates so they no longer need to live on the Workouts list.
 */
async function promoteOrphanMultiDayStrengthPlans(): Promise<void> {
  const access = await ensureManualPlanCreation().catch(() => null);
  if (!access || "error" in access) return;
  const { admin, userId } = access;

  const { data: strengthPlans } = await admin
    .from("workout_plans")
    .select("id, title, description")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "strength");
  if (!strengthPlans?.length) return;

  const { data: weekPlans } = await admin
    .from("workout_plans")
    .select("id, title, week_config")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week");

  const referencedPlanIds = new Set<string>();
  const weekTitles = new Set<string>();
  for (const week of weekPlans ?? []) {
    weekTitles.add(String(week.title ?? "").trim().toLowerCase());
    const config = (await import("@/lib/week-plan")).normalizeWeekPlanConfig(
      week.week_config
    );
    for (const day of config?.days ?? []) {
      referencedPlanIds.add(day.mainPlanId);
    }
  }

  const defaultWeekdays = (count: number) => {
    if (count >= 5) return [1, 2, 3, 4, 5];
    if (count >= 4) return [1, 2, 4, 5];
    if (count === 3) return [1, 3, 5];
    if (count === 2) return [1, 4];
    return [1];
  };

  for (const plan of strengthPlans) {
    const planId = plan.id as string;
    if (referencedPlanIds.has(planId)) continue;

    const { data: days } = await admin
      .from("workout_days")
      .select("id, day_index, title")
      .eq("plan_id", planId)
      .order("day_index");
    if (!days || days.length < 2) continue;

    const title = String(plan.title ?? "Week plan").trim() || "Week plan";
    if (weekTitles.has(title.toLowerCase())) continue;

    const weekdays = defaultWeekdays(days.length);
    const week_config = {
      includeExtras: false,
      days: days.map((day, i) => ({
        focus: String(day.title ?? `Day ${i + 1}`),
        weekday: weekdays[i] ?? weekdays[weekdays.length - 1] ?? 1,
        mainPlanId: planId,
        mainDayId: day.id as string,
        warmupPlanId: null,
        stretchPlanId: null,
      })),
    };

    await admin.from("workout_plans").insert({
      title,
      description:
        (plan.description as string | null) ||
        `Migrated from multi-day workout · ${days.length} training days`,
      created_by: userId,
      is_personal: true,
      folder_id: null,
      kind: "week",
      week_config,
    });
    weekTitles.add(title.toLowerCase());
  }
}

export type WeekPlanBuilderWorkoutOption = {
  planId: string;
  title: string;
  kind: "strength" | "hiit";
  days: { dayId: string; title: string; dayIndex: number }[];
};

export type WeekPlanBuilderExtraOption = {
  planId: string;
  title: string;
  kind: "warmup" | "stretch";
};

/** Workouts + extras available when building a week plan manually. */
export async function getWeekPlanBuilderOptions(): Promise<{
  workouts: WeekPlanBuilderWorkoutOption[];
  warmups: WeekPlanBuilderExtraOption[];
  stretches: WeekPlanBuilderExtraOption[];
}> {
  const { supabase, userId } = await requireUserId();
  const plans = await getPersonalWorkoutPlans();
  const mains = plans.filter(
    (p) => p.kind === "strength" || p.kind === "hiit"
  );
  const warmups = plans
    .filter((p) => p.kind === "warmup")
    .map((p) => ({
      planId: p.id as string,
      title: (p.title as string) || "Warm-up",
      kind: "warmup" as const,
    }));
  const stretches = plans
    .filter((p) => p.kind === "stretch")
    .map((p) => ({
      planId: p.id as string,
      title: (p.title as string) || "Stretching",
      kind: "stretch" as const,
    }));

  if (mains.length === 0) {
    return { workouts: [], warmups, stretches };
  }

  const { data: days } = await supabase
    .from("workout_days")
    .select("id, plan_id, day_index, title")
    .in(
      "plan_id",
      mains.map((p) => p.id)
    )
    .order("day_index");

  const daysByPlan = new Map<
    string,
    { dayId: string; title: string; dayIndex: number }[]
  >();
  for (const day of days ?? []) {
    const list = daysByPlan.get(day.plan_id) ?? [];
    list.push({
      dayId: day.id as string,
      title: (day.title as string) || `Day ${(day.day_index as number) + 1}`,
      dayIndex: day.day_index as number,
    });
    daysByPlan.set(day.plan_id, list);
  }

  const workouts: WeekPlanBuilderWorkoutOption[] = mains.flatMap((plan) => {
    const planDays = daysByPlan.get(plan.id) ?? [];
    if (planDays.length === 0) return [];
    return [
      {
        planId: plan.id as string,
        title: (plan.title as string) || "Workout",
        kind: plan.kind === "hiit" ? "hiit" : "strength",
        days: planDays,
      },
    ];
  });

  return { workouts, warmups, stretches };
}

type WeekPlanAdmin = Extract<
  Awaited<ReturnType<typeof ensureManualPlanCreation>>,
  { admin: unknown }
>["admin"];

async function buildWeekConfigFromInput(
  admin: WeekPlanAdmin,
  userId: string,
  days: {
    weekday: number;
    mainPlanId: string;
    mainDayId: string;
    focus?: string;
    warmupPlanId?: string | null;
    stretchPlanId?: string | null;
  }[]
): Promise<
  | { error: string }
  | { week_config: import("@/lib/week-plan").WeekPlanConfig }
> {
  if (!days?.length) {
    return { error: "Add at least one training day" };
  }

  const weekDays: import("@/lib/week-plan").WeekPlanDayConfig[] = [];
  const usedWeekdays = new Set<number>();

  for (const day of days) {
    const weekday = Math.round(Number(day.weekday));
    if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) {
      return { error: "Invalid weekday" };
    }
    if (usedWeekdays.has(weekday)) {
      return { error: "Each weekday can only be used once" };
    }
    usedWeekdays.add(weekday);

    const mainPlanId = day.mainPlanId?.trim();
    const mainDayId = day.mainDayId?.trim();
    if (!mainPlanId || !mainDayId) {
      return { error: "Pick a workout for each training day" };
    }

    const { data: plan } = await admin
      .from("workout_plans")
      .select("id, title, kind")
      .eq("id", mainPlanId)
      .eq("created_by", userId)
      .eq("is_personal", true)
      .maybeSingle();
    if (!plan || (plan.kind !== "strength" && plan.kind !== "hiit")) {
      return { error: "Workout not found" };
    }

    const { data: dayRow } = await admin
      .from("workout_days")
      .select("id, title")
      .eq("id", mainDayId)
      .eq("plan_id", mainPlanId)
      .maybeSingle();
    if (!dayRow) return { error: "Workout day not found" };

    let warmupPlanId: string | null = null;
    let stretchPlanId: string | null = null;

    if (day.warmupPlanId) {
      const { data: w } = await admin
        .from("workout_plans")
        .select("id")
        .eq("id", day.warmupPlanId)
        .eq("created_by", userId)
        .eq("kind", "warmup")
        .maybeSingle();
      if (!w) return { error: "Warm-up not found" };
      warmupPlanId = w.id as string;
    }
    if (day.stretchPlanId) {
      const { data: s } = await admin
        .from("workout_plans")
        .select("id")
        .eq("id", day.stretchPlanId)
        .eq("created_by", userId)
        .eq("kind", "stretch")
        .maybeSingle();
      if (!s) return { error: "Stretch not found" };
      stretchPlanId = s.id as string;
    }

    weekDays.push({
      focus:
        day.focus?.trim() ||
        (dayRow.title as string) ||
        (plan.title as string) ||
        "Training",
      weekday,
      mainPlanId,
      mainDayId,
      warmupPlanId,
      stretchPlanId,
    });
  }

  weekDays.sort((a, b) => a.weekday - b.weekday);

  return {
    week_config: {
      includeExtras: weekDays.some((d) => d.warmupPlanId || d.stretchPlanId),
      days: weekDays,
    },
  };
}

/** Create a reusable week template from existing library workouts. */
export async function createPersonalWeekPlan(input: {
  title: string;
  description?: string;
  days: {
    weekday: number;
    mainPlanId: string;
    mainDayId: string;
    focus?: string;
    warmupPlanId?: string | null;
    stretchPlanId?: string | null;
  }[];
}) {
  const access = await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const built = await buildWeekConfigFromInput(admin, userId, input.days);
  if ("error" in built) return { error: built.error };

  const { data: weekPlan, error } = await admin
    .from("workout_plans")
    .insert({
      title,
      description: input.description?.trim() || null,
      created_by: userId,
      is_personal: true,
      folder_id: null,
      kind: "week",
      week_config: built.week_config,
    })
    .select("id")
    .single();

  if (error || !weekPlan) {
    return { error: error?.message ?? "Could not create week plan" };
  }

  revalidatePath("/dashboard/workout/plans");
  revalidatePath("/dashboard/workout");
  return { success: true as const, id: weekPlan.id as string };
}

export async function getPersonalWeekPlan(
  planId: string
): Promise<PersonalWeekPlanListItem | null> {
  const { supabase, userId } = await requireUserId();
  const { normalizeWeekPlanConfig } = await import("@/lib/week-plan");

  const { data: plan } = await supabase
    .from("workout_plans")
    .select(WORKOUT_PLAN_WEEK_LIST_COLUMNS)
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week")
    .maybeSingle();

  if (!plan) return null;
  const config = normalizeWeekPlanConfig(plan.week_config);
  if (!config) return null;

  return {
    id: plan.id as string,
    title: (plan.title as string) || "Week plan",
    description: (plan.description as string | null) ?? null,
    createdAt: (plan.created_at as string | null) ?? null,
    config,
  };
}

export type WeekPlanPreviewExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

export type WeekPlanPreviewWorkout = {
  weekday: number;
  focus: string;
  planId: string;
  dayId: string;
  planTitle: string;
  planKind: string;
  dayTitle: string;
  exercises: WeekPlanPreviewExercise[];
};

/** Week template + resolved workouts/exercises for preview. */
export async function getWeekPlanPreview(planId: string): Promise<{
  plan: PersonalWeekPlanListItem;
  workouts: WeekPlanPreviewWorkout[];
} | null> {
  const weekPlan = await getPersonalWeekPlan(planId);
  if (!weekPlan) return null;

  const { supabase, userId } = await requireUserId();
  const { isIntervalPlan, normalizeHiitConfig } = await import("@/lib/hiit");

  const planIds = [
    ...new Set(weekPlan.config.days.map((d) => d.mainPlanId).filter(Boolean)),
  ];
  if (planIds.length === 0) {
    return { plan: weekPlan, workouts: [] };
  }

  const [{ data: plans }, { data: days }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select(WORKOUT_PLAN_LIST_COLUMNS)
      .in("id", planIds)
      .eq("created_by", userId)
      .eq("is_personal", true),
    supabase
      .from("workout_days")
      .select(WORKOUT_DAY_WITH_EXERCISES)
      .in("plan_id", planIds)
      .order("day_index"),
  ]);

  const planById = new Map((plans ?? []).map((p) => [p.id as string, p]));
  const daysByPlan = new Map<string, typeof days>();
  for (const day of days ?? []) {
    const list = daysByPlan.get(day.plan_id as string) ?? [];
    list.push(day);
    daysByPlan.set(day.plan_id as string, list);
  }

  const workouts: WeekPlanPreviewWorkout[] = weekPlan.config.days
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .flatMap((day) => {
      const plan = planById.get(day.mainPlanId);
      if (!plan) return [];
      const planDays = daysByPlan.get(day.mainPlanId) ?? [];
      const workoutDay =
        planDays.find((d) => d.id === day.mainDayId) ?? planDays[0] ?? null;

      let exercises: WeekPlanPreviewExercise[] = [];
      if (isIntervalPlan(plan)) {
        const config = normalizeHiitConfig(plan.hiit_config);
        exercises = (config?.exercises ?? []).map((ex, index) => ({
          id: `hiit-${day.mainPlanId}-${index}`,
          name: ex.name,
          sets: 1,
          reps: `${ex.work_seconds}s`,
          notes: ex.notes ?? null,
          image_url: ex.image_url ?? null,
          video_url: ex.video_url ?? null,
        }));
      } else {
        const raw = (workoutDay?.exercises ?? []) as {
          id: string;
          name: string;
          sets: number;
          reps: string;
          notes: string | null;
          image_url?: string | null;
          video_url?: string | null;
          order_index?: number | null;
        }[];
        exercises = raw
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((ex) => ({
            id: ex.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            notes: ex.notes,
            image_url: ex.image_url,
            video_url: ex.video_url,
          }));
      }

      return [
        {
          weekday: day.weekday,
          focus: day.focus,
          planId: day.mainPlanId,
          dayId: (workoutDay?.id as string) || day.mainDayId,
          planTitle: (plan.title as string) || day.focus,
          planKind: ((plan.kind as string | null) ?? "strength") as string,
          dayTitle:
            (workoutDay?.title as string) ||
            (plan.title as string) ||
            day.focus,
          exercises,
        },
      ];
    });

  return { plan: weekPlan, workouts };
}

/** Update an existing week template. */
export async function updatePersonalWeekPlan(input: {
  planId: string;
  title: string;
  description?: string;
  days: {
    weekday: number;
    mainPlanId: string;
    mainDayId: string;
    focus?: string;
    warmupPlanId?: string | null;
    stretchPlanId?: string | null;
  }[];
}) {
  const access = await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  const planId = input.planId?.trim();
  if (!planId) return { error: "Plan not found" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const { data: existing } = await admin
    .from("workout_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week")
    .maybeSingle();
  if (!existing) return { error: "Week plan not found" };

  const built = await buildWeekConfigFromInput(admin, userId, input.days);
  if ("error" in built) return { error: built.error };

  const week_config = {
    ...built.week_config,
    lastScheduledAt: null,
    scheduledUntil: null,
    scheduledStartDate: null,
    scheduledWeeks: null,
  };

  const { error } = await admin
    .from("workout_plans")
    .update({
      title,
      description: input.description?.trim() || null,
      week_config,
    })
    .eq("id", planId)
    .eq("created_by", userId);

  if (error) {
    return { error: error.message ?? "Could not update week plan" };
  }

  revalidatePath("/dashboard/workout/plans");
  revalidatePath(`/dashboard/workout/plans/${planId}/edit`);
  revalidatePath("/dashboard/workout");
  return { success: true as const, id: planId };
}

/** Schedule an existing week template for N weeks onto the calendar. */
export async function schedulePersonalWeekPlan(input: {
  weekPlanId: string;
  weeks: number;
  startDate?: string;
}) {
  const access = await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;
  const { normalizeWeekPlanConfig } = await import("@/lib/week-plan");

  const { data: plan } = await admin
    .from("workout_plans")
    .select("id, title, kind, week_config")
    .eq("id", input.weekPlanId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week")
    .maybeSingle();

  if (!plan) return { error: "Week plan not found" };
  const config = normalizeWeekPlanConfig(plan.week_config);
  if (!config?.days.length) return { error: "Week plan has no training days" };

  const weeks = Math.min(52, Math.max(1, Math.round(input.weeks) || 4));
  const startDate =
    input.startDate?.trim() ||
    config.scheduledStartDate ||
    new Date().toISOString().split("T")[0]!;
  const anchor = new Date(startDate + "T12:00:00");

  const uniqueWeekdays = [
    ...new Set(config.days.map((d) => d.weekday).filter((d) => d >= 0 && d <= 6)),
  ];
  const targetDates = new Set<string>();
  for (const weekday of uniqueWeekdays) {
    for (const d of generateRecurringScheduleDates(anchor, [weekday], weeks)) {
      targetDates.add(d);
    }
  }

  // Also clear any leftover dates from a previous schedule of this plan.
  const datesToClear = new Set(targetDates);
  if (config.scheduledStartDate && config.scheduledWeeks) {
    const prevAnchor = new Date(config.scheduledStartDate + "T12:00:00");
    for (const weekday of uniqueWeekdays) {
      for (const d of generateRecurringScheduleDates(
        prevAnchor,
        [weekday],
        config.scheduledWeeks
      )) {
        datesToClear.add(d);
      }
    }
  }

  if (datesToClear.size > 0) {
    try {
      await clearScheduledWorkoutsOnDates(admin, userId, [...datesToClear]);
    } catch (e) {
      return {
        error:
          e instanceof Error ? e.message : "Could not clear existing schedule",
      };
    }
  }

  let scheduledCount = 0;
  for (const day of config.days) {
    const dates = generateRecurringScheduleDates(anchor, [day.weekday], weeks);
    for (const dateKey of dates) {
      const refs: { planId: string; dayId: string }[] = [];
      if (config.includeExtras && day.warmupPlanId) {
        const { data: wDay } = await admin
          .from("workout_days")
          .select("id")
          .eq("plan_id", day.warmupPlanId)
          .order("day_index")
          .limit(1)
          .maybeSingle();
        if (wDay?.id) {
          refs.push({ planId: day.warmupPlanId, dayId: wDay.id as string });
        }
      }
      refs.push({ planId: day.mainPlanId, dayId: day.mainDayId });
      if (config.includeExtras && day.stretchPlanId) {
        const { data: sDay } = await admin
          .from("workout_days")
          .select("id")
          .eq("plan_id", day.stretchPlanId)
          .order("day_index")
          .limit(1)
          .maybeSingle();
        if (sDay?.id) {
          refs.push({ planId: day.stretchPlanId, dayId: sDay.id as string });
        }
      }

      for (const ref of refs) {
        const result = await addWorkoutToDay(dateKey, ref.planId, ref.dayId);
        if (result?.error) {
          return {
            error: `Scheduled partially, then failed on ${dateKey}: ${result.error}`,
          };
        }
        scheduledCount += 1;
      }
    }
  }

  // Mark this template as currently scheduled; clear the flag on siblings.
  const scheduledAt = new Date().toISOString();
  const scheduledUntil =
    [...targetDates].sort().at(-1) ?? startDate;
  const { data: siblingPlans } = await admin
    .from("workout_plans")
    .select("id, week_config")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "week");

  for (const sibling of siblingPlans ?? []) {
    const siblingConfig = normalizeWeekPlanConfig(sibling.week_config);
    if (!siblingConfig) continue;
    const isThis = sibling.id === plan.id;
    const nextConfig = isThis
      ? {
          ...siblingConfig,
          lastScheduledAt: scheduledAt,
          scheduledUntil,
          scheduledStartDate: startDate,
          scheduledWeeks: weeks,
        }
      : siblingConfig.lastScheduledAt ||
          siblingConfig.scheduledUntil ||
          siblingConfig.scheduledWeeks
        ? {
            ...siblingConfig,
            lastScheduledAt: null,
            scheduledUntil: null,
            scheduledStartDate: null,
            scheduledWeeks: null,
          }
        : null;
    if (!nextConfig) continue;
    await admin
      .from("workout_plans")
      .update({ week_config: nextConfig })
      .eq("id", sibling.id)
      .eq("created_by", userId);
  }

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/plans");
  revalidatePath("/dashboard/workout/plans");
  return { success: true as const, count: scheduledCount, weeks };
}

export interface PersonalExerciseLibraryItem {
  id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  planId: string;
  planTitle: string;
  dayTitle: string;
}

export async function getPersonalExercisesLibrary(): Promise<PersonalExerciseLibraryItem[]> {
  const plans = await getPersonalWorkoutPlans();
  const items: PersonalExerciseLibraryItem[] = [];

  for (const plan of plans) {
    const { days } = await getPersonalWorkoutPlanWithDetails(plan.id);
    for (const day of days) {
      const exercises = (day.exercises ?? []).sort(
        (a: Exercise, b: Exercise) => a.order_index - b.order_index
      );
      for (const exercise of exercises) {
        items.push({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          planId: plan.id,
          planTitle: plan.title,
          dayTitle: day.title,
        });
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function mapScheduledWorkoutRow(data: {
  id: string;
  client_id: string;
  scheduled_date: string;
  plan_id: string;
  day_id: string;
  order_index?: number;
  created_at: string;
  workout_plans?: unknown;
  workout_days?: unknown;
}): ScheduledWorkout | null {
  if (!data.workout_days) return data as ScheduledWorkout;

  const rawDay = data.workout_days;
  const day = (Array.isArray(rawDay) ? rawDay[0] : rawDay) as WorkoutDay & {
    exercises?: { order_index: number }[];
  };
  const rawPlan = data.workout_plans;
  const workoutPlan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

  return {
    id: data.id,
    client_id: data.client_id,
    scheduled_date: data.scheduled_date,
    plan_id: data.plan_id,
    day_id: data.day_id,
    order_index: data.order_index,
    created_at: data.created_at,
    workout_plans: workoutPlan ?? undefined,
    workout_days: {
      ...day,
      exercises: (day.exercises ?? []).sort(
        (a, b) => a.order_index - b.order_index
      ),
    },
  } satisfies ScheduledWorkout;
}

export async function getScheduledWorkoutsForDate(
  clientId: string,
  date: string
): Promise<ScheduledWorkout[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("scheduled_workouts")
    .select(
      `id, client_id, scheduled_date, plan_id, day_id, order_index, created_at, workout_plans(${WORKOUT_PLAN_LIST_COLUMNS}), workout_days(${WORKOUT_DAY_WITH_EXERCISES})`
    )
    .eq("client_id", clientId)
    .eq("scheduled_date", date)
    .order("order_index")
    .order("created_at");

  return (data ?? [])
    .map((row) => mapScheduledWorkoutRow(row))
    .filter((row): row is ScheduledWorkout => row != null);
}

export async function getScheduledWorkoutForDate(
  clientId: string,
  date: string
): Promise<ScheduledWorkout | null> {
  const scheduled = await getScheduledWorkoutsForDate(clientId, date);
  return scheduled[0] ?? null;
}
