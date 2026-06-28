"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSubscribedMutationAdmin, requireOwnedClient } from "@/lib/actions/auth-client";
import {
  WORKOUT_SESSION_COLUMNS,
  WORKOUT_SESSION_EXERCISE_COLUMNS,
  WORKOUT_SESSION_SET_COLUMNS,
} from "@/lib/db-selects";
import { getClientWorkoutAssignment } from "@/lib/actions/plans";
import { getScheduledWorkoutsForDate } from "@/lib/actions/user-workouts";
import { getTaskCompletionsForDate } from "@/lib/actions/task-completions";
import { formatDateKey } from "@/lib/utils";
import { workoutTaskId } from "@/lib/workout-task-id";
import type {
  Exercise,
  ExerciseHistoryEntry,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from "@/lib/types";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

async function requireMutationAdmin() {
  const mutation = await requireSubscribedMutationAdmin();
  if ("error" in mutation) throw new Error(mutation.error);
  return { admin: mutation.admin, userId: mutation.userId };
}

async function tryMutationAdmin() {
  const mutation = await requireSubscribedMutationAdmin();
  if ("error" in mutation) return null;
  return { admin: mutation.admin, userId: mutation.userId };
}

type PlanDayExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes: string | null;
  order_index: number;
};

async function loadPlanDayExercises(
  admin: Awaited<ReturnType<typeof requireMutationAdmin>>["admin"],
  planId: string,
  dayId: string
): Promise<PlanDayExercise[]> {
  const { data: day } = await admin
    .from("workout_days")
    .select("exercises(id, name, sets, reps, notes, order_index)")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .single();

  return ((day?.exercises as PlanDayExercise[]) ?? []).sort(
    (a, b) => a.order_index - b.order_index
  );
}

async function seedSessionExercisesFromPlan(
  admin: Awaited<ReturnType<typeof requireMutationAdmin>>["admin"],
  sessionId: string,
  exercises: PlanDayExercise[]
): Promise<{ error?: string }> {
  if (exercises.length === 0) {
    return { error: "No exercises on this workout day" };
  }

  for (const [index, exercise] of exercises.entries()) {
    const { data: sessionExercise, error: exError } = await admin
      .from("workout_session_exercises")
      .insert({
        session_id: sessionId,
        exercise_id: exercise.id,
        name: exercise.name,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        order_index: index,
        notes: exercise.notes,
      })
      .select()
      .single();

    if (exError || !sessionExercise) {
      return {
        error: exError?.message ?? `Failed to add exercise: ${exercise.name}`,
      };
    }

    const setRows = Array.from({ length: exercise.sets }, (_, i) => ({
      session_exercise_id: sessionExercise.id,
      set_number: i + 1,
      completed: false,
    }));

    const { error: setsError } = await admin
      .from("workout_session_sets")
      .insert(setRows);
    if (setsError) return { error: setsError.message };
  }

  return {};
}

async function mapSessionExercises(
  admin: Awaited<ReturnType<typeof requireMutationAdmin>>["admin"],
  sessionId: string
): Promise<WorkoutSessionExercise[]> {
  const { data: exercises, error } = await admin
    .from("workout_session_exercises")
    .select(
      `${WORKOUT_SESSION_EXERCISE_COLUMNS}, workout_session_sets(${WORKOUT_SESSION_SET_COLUMNS})`
    )
    .eq("session_id", sessionId)
    .order("order_index");

  if (error) return [];

  const mappedExercises: WorkoutSessionExercise[] = (exercises ?? []).map(
    (ex) => ({
      ...ex,
      sets: ((ex.workout_session_sets as WorkoutSessionSet[]) ?? []).sort(
        (a, b) => a.set_number - b.set_number
      ),
    })
  );

  const planExerciseIds = mappedExercises
    .map((ex) => ex.exercise_id)
    .filter((id): id is string => !!id);

  if (planExerciseIds.length > 0) {
    const { data: planExercises } = await admin
      .from("exercises")
      .select("id, video_url, rest_seconds")
      .in("id", planExerciseIds);

    const metaById = new Map(
      (planExercises ?? []).map((ex) => [
        ex.id,
        {
          video_url: ex.video_url as string | null,
          rest_seconds: ex.rest_seconds as number | null,
        },
      ])
    );

    for (const ex of mappedExercises) {
      if (ex.exercise_id) {
        const meta = metaById.get(ex.exercise_id);
        ex.video_url = meta?.video_url ?? null;
        ex.rest_seconds = meta?.rest_seconds ?? null;
      }
    }
  }

  return mappedExercises;
}

export interface TodaysWorkoutInfo {
  planId: string;
  dayId: string;
  planTitle: string;
  dayTitle: string;
  scheduledDate: string | null;
  scheduledWorkoutId?: string | null;
  taskId: string;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    notes: string | null;
  }[];
}

function mapScheduledToWorkoutInfo(
  scheduled: Awaited<ReturnType<typeof getScheduledWorkoutsForDate>>[number],
  dateKey: string
): TodaysWorkoutInfo | null {
  if (!scheduled.workout_days || !scheduled.plan_id) return null;
  const day = scheduled.workout_days;
  const exercises = (day.exercises ?? []).sort(
    (a: Exercise, b: Exercise) => a.order_index - b.order_index
  );
  return {
    planId: scheduled.plan_id,
    dayId: day.id,
    planTitle: scheduled.workout_plans?.title ?? "Workout",
    dayTitle: day.title,
    scheduledDate: dateKey,
    scheduledWorkoutId: scheduled.id,
    taskId: workoutTaskId(dateKey, scheduled.id),
    exercises: exercises.map((ex: Exercise) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      notes: ex.notes,
    })),
  };
}

export async function resolveWorkoutsForDate(
  clientId: string,
  dateKey: string
): Promise<TodaysWorkoutInfo[]> {
  const scheduled = await getScheduledWorkoutsForDate(clientId, dateKey);
  if (scheduled.length > 0) {
    return scheduled
      .map((entry) => mapScheduledToWorkoutInfo(entry, dateKey))
      .filter((entry): entry is TodaysWorkoutInfo => entry != null);
  }

  const assignment = await getClientWorkoutAssignment(clientId);
  const days =
    assignment?.workout_plans?.workout_days?.sort(
      (a: { day_index: number }, b: { day_index: number }) =>
        a.day_index - b.day_index
    ) ?? [];
  if (days.length === 0 || !assignment?.plan_id) return [];

  const date = new Date(dateKey + "T12:00:00");
  const day = days[date.getDay() % days.length];
  const exercises = (day.exercises ?? []).sort(
    (a: Exercise, b: Exercise) => a.order_index - b.order_index
  );

  return [
    {
      planId: assignment.plan_id,
      dayId: day.id,
      planTitle: assignment.workout_plans?.title ?? "Workout",
      dayTitle: day.title,
      scheduledDate: null,
      scheduledWorkoutId: null,
      taskId: workoutTaskId(dateKey, null),
      exercises: exercises.map((ex: Exercise) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        notes: ex.notes,
      })),
    },
  ];
}

export async function resolveWorkoutForDate(
  clientId: string,
  dateKey: string
): Promise<TodaysWorkoutInfo | null> {
  const workouts = await resolveWorkoutsForDate(clientId, dateKey);
  return workouts[0] ?? null;
}

async function findCompletedSessionIdForWorkout(
  clientId: string,
  dateKey: string,
  workout: TodaysWorkoutInfo
): Promise<string | null> {
  const supabase = await createClient();

  if (workout.scheduledWorkoutId) {
    const { data: byScheduledWorkout } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .eq("scheduled_workout_id", workout.scheduledWorkoutId)
      .maybeSingle();
    if (byScheduledWorkout) return byScheduledWorkout.id;
  }

  const { data: byPlanDayDate } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .eq("plan_id", workout.planId)
    .eq("day_id", workout.dayId)
    .eq("scheduled_date", dateKey)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byPlanDayDate) return byPlanDayDate.id;

  const taskCompletions = await getTaskCompletionsForDate(clientId, dateKey);
  if (taskCompletions.has(workout.taskId)) {
    const { data: byTaskDate } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .eq("plan_id", workout.planId)
      .eq("day_id", workout.dayId)
      .eq("scheduled_date", dateKey)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byTaskDate) return byTaskDate.id;
  }

  return null;
}

async function findCompletedSessionIdForDate(
  clientId: string,
  dateKey: string
): Promise<string | null> {
  const workouts = await resolveWorkoutsForDate(clientId, dateKey);
  for (const workout of workouts) {
    const sessionId = await findCompletedSessionIdForWorkout(
      clientId,
      dateKey,
      workout
    );
    if (sessionId) return sessionId;
  }

  const supabase = await createClient();
  const { data: bySchedule } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .eq("scheduled_date", dateKey)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bySchedule) return bySchedule.id;

  const { data: byCompletedAt } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .gte("completed_at", `${dateKey}T00:00:00`)
    .lte("completed_at", `${dateKey}T23:59:59.999Z`)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return byCompletedAt?.id ?? null;
}

async function resolveWorkoutTaskIdForSession(
  clientId: string,
  session: {
    scheduled_date: string | null;
    scheduled_workout_id: string | null;
    started_at: string | null;
    plan_id: string | null;
    day_id: string | null;
  }
): Promise<{ scheduledDate: string; taskId: string }> {
  const scheduledDate =
    session.scheduled_date ??
    (session.started_at
      ? formatDateKey(new Date(session.started_at))
      : formatDateKey(new Date()));

  if (session.scheduled_workout_id) {
    return {
      scheduledDate,
      taskId: workoutTaskId(scheduledDate, session.scheduled_workout_id),
    };
  }

  const workouts = await resolveWorkoutsForDate(clientId, scheduledDate);
  const match = workouts.find(
    (workout) =>
      session.plan_id != null &&
      session.day_id != null &&
      workout.planId === session.plan_id &&
      workout.dayId === session.day_id
  );

  return {
    scheduledDate,
    taskId: match?.taskId ?? workoutTaskId(scheduledDate, null),
  };
}

export async function getWorkoutCompletedTaskIdsInRange(
  clientId: string,
  from: string,
  to: string
): Promise<Record<string, Set<string>>> {
  const supabase = await createClient();

  const [scheduledResult, unscheduledResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("scheduled_date")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to),
    supabase
      .from("workout_sessions")
      .select("completed_at")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .is("scheduled_date", null)
      .gte("completed_at", `${from}T00:00:00`)
      .lte("completed_at", `${to}T23:59:59.999Z`),
  ]);

  const dates = new Set<string>();
  for (const row of scheduledResult.data ?? []) {
    if (row.scheduled_date) dates.add(row.scheduled_date);
  }
  for (const row of unscheduledResult.data ?? []) {
    if (row.completed_at) {
      dates.add(formatDateKey(new Date(row.completed_at)));
    }
  }

  const result: Record<string, Set<string>> = {};
  await Promise.all(
    [...dates].map(async (dateKey) => {
      const status = await getWorkoutCompletionStatusForDate(clientId, dateKey);
      const completed = new Set<string>();
      for (const [taskId, entry] of Object.entries(status)) {
        if (entry.completed) completed.add(taskId);
      }
      if (completed.size > 0) result[dateKey] = completed;
    })
  );

  return result;
}

export async function getWorkoutCompletionStatusForDate(
  clientId: string,
  dateKey: string
): Promise<
  Record<
    string,
    {
      completed: boolean;
      sessionId: string | null;
    }
  >
> {
  const workouts = await resolveWorkoutsForDate(clientId, dateKey);
  const taskCompletions = await getTaskCompletionsForDate(clientId, dateKey);
  const status: Record<
    string,
    { completed: boolean; sessionId: string | null }
  > = {};

  for (const workout of workouts) {
    const sessionId = await findCompletedSessionIdForWorkout(
      clientId,
      dateKey,
      workout
    );
    status[workout.taskId] = {
      completed: !!sessionId || taskCompletions.has(workout.taskId),
      sessionId,
    };
  }

  return status;
}

export interface CompletedWorkoutResults {
  sessionId: string;
  dayTitle: string | null;
  planTitle: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  exercises: {
    id: string;
    name: string;
    targetReps: string;
    sets: {
      setNumber: number;
      reps: number | null;
      weightKg: number | null;
    }[];
  }[];
}

export async function getCompletedWorkoutResultsForSession(
  sessionId: string
): Promise<CompletedWorkoutResults | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("client_id", user.id)
    .eq("status", "completed")
    .single();

  if (!session) return null;

  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select(
      `id, name, target_reps, order_index, workout_session_sets(${WORKOUT_SESSION_SET_COLUMNS})`
    )
    .eq("session_id", sessionId)
    .order("order_index");

  return {
    sessionId: session.id,
    dayTitle: session.day_title,
    planTitle: session.plan_title,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    notes: session.notes,
    exercises: (exercises ?? []).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      targetReps: exercise.target_reps,
      sets: (
        (exercise.workout_session_sets as WorkoutSessionSet[]) ?? []
      )
        .sort((a, b) => a.set_number - b.set_number)
        .map((set) => ({
          setNumber: set.set_number,
          reps: set.reps,
          weightKg: set.weight_kg != null ? Number(set.weight_kg) : null,
        })),
    })),
  };
}

export async function getCompletedWorkoutResultsForDate(
  clientId: string,
  dateKey: string
): Promise<CompletedWorkoutResults | null> {
  const sessionId = await findCompletedSessionIdForDate(clientId, dateKey);
  if (!sessionId) return null;
  return getCompletedWorkoutResultsForSession(sessionId);
}

export async function isWorkoutCompletedOnDate(
  clientId: string,
  dateKey: string
): Promise<boolean> {
  const workouts = await resolveWorkoutsForDate(clientId, dateKey);
  if (workouts.length === 0) return false;

  const status = await getWorkoutCompletionStatusForDate(clientId, dateKey);
  return workouts.every((workout) => status[workout.taskId]?.completed);
}

export async function getInProgressSession(): Promise<WorkoutSession | null> {
  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_COLUMNS)
    .eq("client_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getSessionWithDetails(sessionId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return null;

  const auth = await requireOwnedClient(userId);
  if ("error" in auth) return null;
  const { admin } = auth;

  let mappedExercises = await mapSessionExercises(admin, sessionId);

  if (
    mappedExercises.length === 0 &&
    session.plan_id &&
    session.day_id &&
    session.status === "in_progress"
  ) {
    const mutation = await tryMutationAdmin();
    if (mutation) {
      const planExercises = await loadPlanDayExercises(
        mutation.admin,
        session.plan_id,
        session.day_id
      );
      if (planExercises.length > 0) {
        await seedSessionExercisesFromPlan(mutation.admin, sessionId, planExercises);
        mappedExercises = await mapSessionExercises(admin, sessionId);
      }
    }
  }

  return { session: session as WorkoutSession, exercises: mappedExercises };
}

export async function getWorkoutSession(sessionId: string) {
  return getSessionWithDetails(sessionId);
}

export async function getExerciseHistory(
  exerciseId: string | null,
  exerciseName: string
): Promise<ExerciseHistoryEntry | null> {
  const { supabase, userId } = await requireUserId();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, completed_at")
    .eq("client_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);

  if (!sessions?.length) return null;

  for (const session of sessions) {
    let exerciseQuery = supabase
      .from("workout_session_exercises")
      .select("id, exercise_id, name")
      .eq("session_id", session.id);

    if (exerciseId) {
      exerciseQuery = exerciseQuery.eq("exercise_id", exerciseId);
    } else {
      exerciseQuery = exerciseQuery.ilike("name", exerciseName);
    }

    const { data: recentExercise } = await exerciseQuery.maybeSingle();
    if (!recentExercise) continue;

    const { data: sets } = await supabase
      .from("workout_session_sets")
      .select("reps, weight_kg")
      .eq("session_exercise_id", recentExercise.id)
      .eq("completed", true)
      .order("set_number");

    if (!sets?.length) continue;

    return {
      exercise_id: recentExercise.exercise_id,
      name: recentExercise.name,
      sets: sets.map((s) => ({
        reps: s.reps,
        weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
      })),
      completed_at: session.completed_at!,
    };
  }

  return null;
}

export async function getExerciseHistories(
  exercises: { exerciseId: string | null; name: string }[]
): Promise<Record<string, ExerciseHistoryEntry | null>> {
  const entries = await Promise.all(
    exercises.map(async (ex) => {
      const history = await getExerciseHistory(ex.exerciseId, ex.name);
      const key = ex.exerciseId ?? ex.name;
      return [key, history] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function startWorkout({
  planId,
  dayId,
  scheduledDate,
  scheduledWorkoutId,
}: {
  planId: string;
  dayId: string;
  scheduledDate?: string | null;
  scheduledWorkoutId?: string | null;
}) {
  const { admin, userId } = await requireMutationAdmin();

  const existing = await getInProgressSession();
  if (existing) {
    const sameWorkout =
      (scheduledWorkoutId &&
        existing.scheduled_workout_id === scheduledWorkoutId) ||
      (existing.plan_id === planId &&
        existing.day_id === dayId &&
        (existing.scheduled_date ?? null) === (scheduledDate ?? null));

    if (!sameWorkout) {
      return {
        error: "Finish your current workout before starting another one",
        sessionId: existing.id,
      };
    }

    if (existing.plan_id && existing.day_id) {
      const { count } = await admin
        .from("workout_session_exercises")
        .select("id", { count: "exact", head: true })
        .eq("session_id", existing.id);
      if (count === 0) {
        const planExercises = await loadPlanDayExercises(
          admin,
          existing.plan_id,
          existing.day_id
        );
        if (planExercises.length > 0) {
          await seedSessionExercisesFromPlan(
            admin,
            existing.id,
            planExercises
          );
        }
      }
    }

    return {
      sessionId: existing.id,
      resumed: true,
      started: existing.started_at != null,
    };
  }

  const { data: day } = await admin
    .from("workout_days")
    .select("*, workout_plans(title)")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .single();

  if (!day) return { error: "Workout day not found" };

  const planTitle =
    (day.workout_plans as { title: string } | null)?.title ?? "Workout";
  const exercises = await loadPlanDayExercises(admin, planId, dayId);

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .insert({
      client_id: userId,
      plan_id: planId,
      day_id: dayId,
      scheduled_date: scheduledDate ?? null,
      scheduled_workout_id: scheduledWorkoutId ?? null,
      day_title: day.title,
      plan_title: planTitle,
      status: "in_progress",
      started_at: null,
    })
    .select()
    .single();

  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Failed to start workout" };
  }

  const seedResult = await seedSessionExercisesFromPlan(
    admin,
    session.id,
    exercises
  );
  if (seedResult.error && exercises.length > 0) {
    await admin.from("workout_sessions").delete().eq("id", session.id);
    return { error: seedResult.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { sessionId: session.id, resumed: false, started: false };
}

export async function beginWorkoutSession(sessionId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: session } = await admin
    .from("workout_sessions")
    .select("id, client_id, status, started_at")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }
  if (session.started_at) {
    return { success: true, alreadyStarted: true };
  }

  const startedAt = new Date().toISOString();
  const { error } = await admin
    .from("workout_sessions")
    .update({ started_at: startedAt })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/session/${sessionId}`);
  return { success: true };
}

export async function startWorkoutAndRedirect({
  planId,
  dayId,
  scheduledDate,
  scheduledWorkoutId,
}: {
  planId: string;
  dayId: string;
  scheduledDate?: string | null;
  scheduledWorkoutId?: string | null;
}) {
  const result = await startWorkout({
    planId,
    dayId,
    scheduledDate,
    scheduledWorkoutId,
  });
  if ("error" in result && result.error) {
    return {
      error: result.error,
      sessionId: "sessionId" in result ? result.sessionId : undefined,
    };
  }
  redirect(`/dashboard/workout/session/${result.sessionId}`);
}

export async function startTodaysWorkoutAndRedirect(
  dateKey: string,
  options?: {
    scheduledWorkoutId?: string | null;
    planId?: string;
    dayId?: string;
  }
) {
  const { userId } = await requireUserId();
  const workouts = await resolveWorkoutsForDate(userId, dateKey);
  if (workouts.length === 0) {
    return { error: "No workout scheduled for this day" };
  }

  const status = await getWorkoutCompletionStatusForDate(userId, dateKey);
  const targetWorkout =
    (options?.scheduledWorkoutId
      ? workouts.find((w) => w.scheduledWorkoutId === options.scheduledWorkoutId)
      : null) ??
    (options?.planId && options?.dayId
      ? workouts.find(
          (w) => w.planId === options.planId && w.dayId === options.dayId
        )
      : null) ??
    workouts.find((w) => !status[w.taskId]?.completed) ??
    workouts[0];

  if (!targetWorkout) {
    return { error: "Workout not found for this day" };
  }

  if (status[targetWorkout.taskId]?.completed) {
    return { error: "This workout is already completed" };
  }

  return startWorkoutAndRedirect({
    planId: targetWorkout.planId,
    dayId: targetWorkout.dayId,
    scheduledDate: targetWorkout.scheduledDate ?? dateKey,
    scheduledWorkoutId: targetWorkout.scheduledWorkoutId,
  });
}

export async function updateSessionSet(
  setId: string,
  updates: { reps?: number | null; weight_kg?: number | null; completed?: boolean }
) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: setRow } = await admin
    .from("workout_session_sets")
    .select("id, session_exercise_id")
    .eq("id", setId)
    .single();

  if (!setRow) return { error: "Set not found" };

  const { data: exercise } = await admin
    .from("workout_session_exercises")
    .select("session_id")
    .eq("id", setRow.session_exercise_id)
    .single();

  if (!exercise) return { error: "Set not found" };

  const { data: session } = await admin
    .from("workout_sessions")
    .select("client_id, status, started_at")
    .eq("id", exercise.session_id)
    .single();

  if (!session || session.client_id !== userId) {
    return { error: "Set not found" };
  }
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }
  if (!session.started_at) {
    return { error: "Start the workout before logging sets" };
  }

  const { error } = await admin
    .from("workout_session_sets")
    .update(updates)
    .eq("id", setId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addSessionSet(sessionExerciseId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: exercise } = await admin
    .from("workout_session_exercises")
    .select("id, target_sets, session_id")
    .eq("id", sessionExerciseId)
    .single();

  if (!exercise) return { error: "Exercise not found" };

  const { data: session } = await admin
    .from("workout_sessions")
    .select("client_id, status, started_at")
    .eq("id", exercise.session_id)
    .single();

  if (!session || session.client_id !== userId) {
    return { error: "Exercise not found" };
  }
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }
  if (!session.started_at) {
    return { error: "Start the workout before logging sets" };
  }

  const { data: existingSets } = await admin
    .from("workout_session_sets")
    .select("set_number")
    .eq("session_exercise_id", sessionExerciseId)
    .order("set_number", { ascending: false })
    .limit(1);

  const nextSetNumber = (existingSets?.[0]?.set_number ?? 0) + 1;

  const { data, error } = await admin
    .from("workout_session_sets")
    .insert({
      session_exercise_id: sessionExerciseId,
      set_number: nextSetNumber,
      completed: false,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as WorkoutSessionSet };
}

export async function addSessionExercise(sessionId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Exercise name is required" };

  const { admin, userId } = await requireMutationAdmin();

  const { data: session } = await admin
    .from("workout_sessions")
    .select("id, status, started_at")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }
  if (!session.started_at) {
    return { error: "Start the workout before adding exercises" };
  }

  const { data: last } = await admin
    .from("workout_session_exercises")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { data: exercise, error } = await admin
    .from("workout_session_exercises")
    .insert({
      session_id: sessionId,
      exercise_id: null,
      name: trimmed,
      target_sets: 3,
      target_reps: "10",
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error || !exercise) return { error: error?.message ?? "Failed to add" };

  const setRows = Array.from({ length: 3 }, (_, i) => ({
    session_exercise_id: exercise.id,
    set_number: i + 1,
    completed: false,
  }));
  await admin.from("workout_session_sets").insert(setRows);

  revalidatePath(`/dashboard/workout/session/${sessionId}`);
  return { data: exercise as WorkoutSessionExercise };
}

export async function completeWorkoutSession(
  sessionId: string,
  notes?: string | null
) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: session } = await admin
    .from("workout_sessions")
    .select("id, status, scheduled_date, scheduled_workout_id, started_at, plan_id, day_id")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.status !== "in_progress") {
    return { error: "Workout already finished" };
  }

  const { data: exercises } = await admin
    .from("workout_session_exercises")
    .select("id, workout_session_sets(id, reps, weight_kg)")
    .eq("session_id", sessionId);

  for (const exercise of exercises ?? []) {
    const sets = (exercise.workout_session_sets as {
      id: string;
      reps: number | null;
      weight_kg: number | null;
    }[]) ?? [];

    for (const set of sets) {
      const hasData = set.reps != null || set.weight_kg != null;
      if (hasData) {
        await admin
          .from("workout_session_sets")
          .update({ completed: true })
          .eq("id", set.id);
      }
    }
  }

  const completedAt = new Date().toISOString();
  const { scheduledDate, taskId } = await resolveWorkoutTaskIdForSession(
    userId,
    session
  );

  const { error } = await admin
    .from("workout_sessions")
    .update({
      status: "completed",
      completed_at: completedAt,
      scheduled_date: scheduledDate,
      scheduled_workout_id: session.scheduled_workout_id,
      notes: notes?.trim() || null,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  const { error: completionError } = await admin
    .from("schedule_task_completions")
    .upsert(
      {
        client_id: userId,
        date: scheduledDate,
        task_id: taskId,
        completed_at: completedAt,
      },
      { onConflict: "client_id,date,task_id" }
    );

  if (completionError) return { error: completionError.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");

  return { success: true, scheduledDate, sessionId, taskId };
}

export async function cancelWorkoutSession(sessionId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { error } = await admin
    .from("workout_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId)
    .eq("client_id", userId)
    .eq("status", "in_progress");

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { success: true };
}

export async function startPlanWorkout(planId: string) {
  const { admin, userId } = await requireMutationAdmin();

  const { data: days } = await admin
    .from("workout_days")
    .select("id, day_index")
    .eq("plan_id", planId)
    .order("day_index");

  if (!days?.length) return { error: "No workout days found" };

  const dayId = await resolveStartDayForPlan(planId, days);
  if (!dayId) return { error: "No workout day found" };

  const today = new Date().toISOString().split("T")[0];
  const { data: scheduled } = await admin
    .from("scheduled_workouts")
    .select("id, scheduled_date, day_id")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .eq("scheduled_date", today)
    .eq("day_id", dayId)
    .maybeSingle();

  return startWorkoutAndRedirect({
    planId,
    dayId,
    scheduledDate: scheduled?.scheduled_date ?? today,
    scheduledWorkoutId: scheduled?.id ?? null,
  });
}

export async function resolveStartDayForPlan(
  planId: string,
  days: { id: string; day_index: number }[]
): Promise<string | null> {
  if (days.length === 0) return null;
  if (days.length === 1) return days[0].id;

  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().split("T")[0];

  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("day_id")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .eq("scheduled_date", today)
    .maybeSingle();

  if (scheduled?.day_id) return scheduled.day_id;

  const sorted = [...days].sort((a, b) => a.day_index - b.day_index);
  return sorted[0].id;
}
