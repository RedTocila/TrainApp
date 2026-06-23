"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientWorkoutAssignment } from "@/lib/actions/plans";
import { getScheduledWorkoutForDate } from "@/lib/actions/user-workouts";
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

export interface TodaysWorkoutInfo {
  planId: string;
  dayId: string;
  planTitle: string;
  dayTitle: string;
  scheduledDate: string | null;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    notes: string | null;
  }[];
}

export async function resolveWorkoutForDate(
  clientId: string,
  dateKey: string
): Promise<TodaysWorkoutInfo | null> {
  const scheduled = await getScheduledWorkoutForDate(clientId, dateKey);
  if (scheduled?.workout_days && scheduled.plan_id) {
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
      exercises: exercises.map((ex: Exercise) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        notes: ex.notes,
      })),
    };
  }

  const assignment = await getClientWorkoutAssignment(clientId);
  const days =
    assignment?.workout_plans?.workout_days?.sort(
      (a: { day_index: number }, b: { day_index: number }) =>
        a.day_index - b.day_index
    ) ?? [];
  if (days.length === 0 || !assignment?.plan_id) return null;

  const date = new Date(dateKey + "T12:00:00");
  const day = days[date.getDay() % days.length];
  const exercises = (day.exercises ?? []).sort(
    (a: Exercise, b: Exercise) => a.order_index - b.order_index
  );

  return {
    planId: assignment.plan_id,
    dayId: day.id,
    planTitle: assignment.workout_plans?.title ?? "Workout",
    dayTitle: day.title,
    scheduledDate: null,
    exercises: exercises.map((ex: Exercise) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      notes: ex.notes,
    })),
  };
}

export async function getInProgressSession(): Promise<WorkoutSession | null> {
  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("workout_sessions")
    .select("*")
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
    .select("*")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return null;

  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select("*, workout_session_sets(*)")
    .eq("session_id", sessionId)
    .order("order_index");

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
    const { data: planExercises } = await supabase
      .from("exercises")
      .select("id, video_url")
      .in("id", planExerciseIds);

    const videoById = new Map(
      (planExercises ?? []).map((ex) => [ex.id, ex.video_url as string | null])
    );

    for (const ex of mappedExercises) {
      if (ex.exercise_id) {
        ex.video_url = videoById.get(ex.exercise_id) ?? null;
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
}: {
  planId: string;
  dayId: string;
  scheduledDate?: string | null;
}) {
  const { supabase, userId } = await requireUserId();

  const existing = await getInProgressSession();
  if (existing) {
    return { sessionId: existing.id, resumed: true };
  }

  const { data: day } = await supabase
    .from("workout_days")
    .select("*, exercises(*), workout_plans(title)")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .single();

  if (!day) return { error: "Workout day not found" };

  const planTitle =
    (day.workout_plans as { title: string } | null)?.title ?? "Workout";
  const exercises = ((day.exercises as {
    id: string;
    name: string;
    sets: number;
    reps: string;
    notes: string | null;
    order_index: number;
  }[]) ?? []).sort((a, b) => a.order_index - b.order_index);

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      client_id: userId,
      plan_id: planId,
      day_id: dayId,
      scheduled_date: scheduledDate ?? null,
      day_title: day.title,
      plan_title: planTitle,
      status: "in_progress",
    })
    .select()
    .single();

  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Failed to start workout" };
  }

  for (const [index, exercise] of exercises.entries()) {
    const { data: sessionExercise, error: exError } = await supabase
      .from("workout_session_exercises")
      .insert({
        session_id: session.id,
        exercise_id: exercise.id,
        name: exercise.name,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        order_index: index,
        notes: exercise.notes,
      })
      .select()
      .single();

    if (exError || !sessionExercise) continue;

    const setRows = Array.from({ length: exercise.sets }, (_, i) => ({
      session_exercise_id: sessionExercise.id,
      set_number: i + 1,
      completed: false,
    }));

    await supabase.from("workout_session_sets").insert(setRows);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  return { sessionId: session.id, resumed: false };
}

export async function startWorkoutAndRedirect({
  planId,
  dayId,
  scheduledDate,
}: {
  planId: string;
  dayId: string;
  scheduledDate?: string | null;
}) {
  const result = await startWorkout({ planId, dayId, scheduledDate });
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  redirect(`/dashboard/workout/session/${result.sessionId}`);
}

export async function startTodaysWorkoutAndRedirect(dateKey: string) {
  const { userId } = await requireUserId();
  const workout = await resolveWorkoutForDate(userId, dateKey);
  if (!workout) {
    return { error: "No workout scheduled for this day" };
  }
  return startWorkoutAndRedirect({
    planId: workout.planId,
    dayId: workout.dayId,
    scheduledDate: workout.scheduledDate,
  });
}

export async function updateSessionSet(
  setId: string,
  updates: { reps?: number | null; weight_kg?: number | null; completed?: boolean }
) {
  const { supabase, userId } = await requireUserId();

  const { data: setRow } = await supabase
    .from("workout_session_sets")
    .select("id, session_exercise_id")
    .eq("id", setId)
    .single();

  if (!setRow) return { error: "Set not found" };

  const { data: exercise } = await supabase
    .from("workout_session_exercises")
    .select("session_id")
    .eq("id", setRow.session_exercise_id)
    .single();

  if (!exercise) return { error: "Set not found" };

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("client_id, status")
    .eq("id", exercise.session_id)
    .single();

  if (!session || session.client_id !== userId) {
    return { error: "Set not found" };
  }
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }

  const { error } = await supabase
    .from("workout_session_sets")
    .update(updates)
    .eq("id", setId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addSessionSet(sessionExerciseId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: exercise } = await supabase
    .from("workout_session_exercises")
    .select("id, target_sets, session_id")
    .eq("id", sessionExerciseId)
    .single();

  if (!exercise) return { error: "Exercise not found" };

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("client_id, status")
    .eq("id", exercise.session_id)
    .single();

  if (!session || session.client_id !== userId) {
    return { error: "Exercise not found" };
  }
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }

  const { data: existingSets } = await supabase
    .from("workout_session_sets")
    .select("set_number")
    .eq("session_exercise_id", sessionExerciseId)
    .order("set_number", { ascending: false })
    .limit(1);

  const nextSetNumber = (existingSets?.[0]?.set_number ?? 0) + 1;

  const { data, error } = await supabase
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

  const { supabase, userId } = await requireUserId();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.status !== "in_progress") {
    return { error: "Workout is no longer in progress" };
  }

  const { data: last } = await supabase
    .from("workout_session_exercises")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { data: exercise, error } = await supabase
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
  await supabase.from("workout_session_sets").insert(setRows);

  revalidatePath(`/dashboard/workout/session/${sessionId}`);
  return { data: exercise as WorkoutSessionExercise };
}

export async function completeWorkoutSession(
  sessionId: string,
  notes?: string | null
) {
  const { supabase, userId } = await requireUserId();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("client_id", userId)
    .single();

  if (!session) return { error: "Session not found" };
  if (session.status !== "in_progress") {
    return { error: "Workout already finished" };
  }

  const { data: exercises } = await supabase
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
        await supabase
          .from("workout_session_sets")
          .update({ completed: true })
          .eq("id", set.id);
      }
    }
  }

  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      notes: notes?.trim() || null,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/session/${sessionId}`);
  return { success: true };
}

export async function cancelWorkoutSession(sessionId: string) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
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
  const { supabase, userId } = await requireUserId();

  const { data: days } = await supabase
    .from("workout_days")
    .select("id, day_index")
    .eq("plan_id", planId)
    .order("day_index");

  if (!days?.length) return { error: "No workout days found" };

  const dayId = await resolveStartDayForPlan(planId, days);
  if (!dayId) return { error: "No workout day found" };

  const today = new Date().toISOString().split("T")[0];
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .eq("scheduled_date", today)
    .maybeSingle();

  return startWorkoutAndRedirect({
    planId,
    dayId,
    scheduledDate: scheduled?.scheduled_date ?? null,
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
