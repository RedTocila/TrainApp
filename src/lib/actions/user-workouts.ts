"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSubscribedUserAccess } from "@/lib/actions/user-access";
import { generateRecurringScheduleDates, inferScheduleFromSessions } from "@/lib/schedule-utils";
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

async function requireMutationUserId() {
  const access = await requireSubscribedUserAccess();
  if ("error" in access) throw new Error(access.error);
  return { supabase: access.supabase, userId: access.userId };
}

export async function createPersonalWorkoutPlan(
  title: string,
  description?: string,
  folderId?: string | null
) {
  const { supabase, userId } = await requireMutationUserId();

  const resolvedFolderId =
    folderId && folderId !== UNCATEGORIZED_FOLDER_ID ? folderId : null;

  if (resolvedFolderId) {
    const { data: folder } = await supabase
      .from("workout_folders")
      .select("id")
      .eq("id", resolvedFolderId)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data, error } = await supabase
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

export async function getPersonalWorkoutPlans(folderId?: string) {
  const { supabase, userId } = await requireUserId();

  let query = supabase
    .from("workout_plans")
    .select("*")
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (folderId === UNCATEGORIZED_FOLDER_ID) {
    query = query.is("folder_id", null);
  } else if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  const { data } = await query.order("created_at", { ascending: false });

  return data ?? [];
}

export async function getPersonalWorkoutPlanWithDetails(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { plan: null, days: [] };

  const { data: days } = await supabase
    .from("workout_days")
    .select("*, exercises(*)")
    .eq("plan_id", planId)
    .order("day_index");

  return { plan, days: days ?? [] };
}

export async function deletePersonalWorkoutPlan(planId: string) {
  const { supabase, userId } = await requireMutationUserId();

  const { error } = await supabase
    .from("workout_plans")
    .delete()
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout");
  return { success: true };
}

export async function assignPersonalWorkoutPlan(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Plan not found" };

  await supabase
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", userId);

  const { error } = await supabase.from("workout_assignments").insert({
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
  const { supabase, userId } = await requireMutationUserId();

  if (!weekdays.length) return { error: "Select at least one day of the week" };
  if (weeks < 1 || weeks > 52) return { error: "Weeks must be between 1 and 52" };

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, is_personal, created_by")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const isOwnPersonal = plan.is_personal && plan.created_by === userId;
  let canSchedule = isOwnPersonal;

  if (!canSchedule) {
    const { data: assignment } = await supabase
      .from("workout_assignments")
      .select("id")
      .eq("client_id", userId)
      .eq("plan_id", planId)
      .eq("active", true)
      .maybeSingle();
    canSchedule = !!assignment;
  }

  if (!canSchedule) return { error: "You cannot schedule this workout" };

  const { data: day } = await supabase
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

  const rows = dates.map((scheduledDate) => ({
    client_id: userId,
    scheduled_date: scheduledDate,
    plan_id: planId,
    day_id: dayId,
  }));

  const { error } = await supabase.from("scheduled_workouts").upsert(rows, {
    onConflict: "client_id,scheduled_date",
  });

  if (error) return { error: error.message };
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

export async function unscheduleWorkout(scheduledDate: string) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("client_id", userId)
    .eq("scheduled_date", scheduledDate);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { success: true };
}

export async function getScheduledWorkoutsInRange(from: string, to: string) {
  const { supabase, userId } = await requireUserId();

  const { data } = await supabase
    .from("scheduled_workouts")
    .select(
      "*, workout_plans(title), workout_days(title, day_index, exercises(id, name, sets, reps, order_index))"
    )
    .eq("client_id", userId)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

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
      .select("*")
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

  const { supabase, userId } = await requireMutationUserId();
  const { data, error } = await supabase
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

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
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
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
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
  const { supabase, userId } = await requireUserId();
  const resolvedTarget =
    targetFolderId === UNCATEGORIZED_FOLDER_ID ? null : targetFolderId;

  if (resolvedTarget) {
    const { data: folder } = await supabase
      .from("workout_folders")
      .select("id")
      .eq("id", resolvedTarget)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data: plan } = await supabase
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

  const { error } = await supabase
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
  const plans = await getPersonalWorkoutPlans(folderId);
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
      .select("*, exercises(*)")
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

  return plans.map((plan) => {
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
  });
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

export async function getScheduledWorkoutForDate(
  clientId: string,
  date: string
): Promise<ScheduledWorkout | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("scheduled_workouts")
    .select("*, workout_plans(*), workout_days(*, exercises(*))")
    .eq("client_id", clientId)
    .eq("scheduled_date", date)
    .maybeSingle();

  if (!data?.workout_days) return data as ScheduledWorkout | null;

  const day = data.workout_days as WorkoutDay & { exercises?: { order_index: number }[] };
  return {
    ...(data as ScheduledWorkout),
    workout_days: {
      ...day,
      exercises: (day.exercises ?? []).sort(
        (a, b) => a.order_index - b.order_index
      ),
    },
  };
}
