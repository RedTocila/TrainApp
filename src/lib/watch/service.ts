import { revalidatePath } from "next/cache";
import {
  checkAlexCommandAllowed,
  consumeAlexCommand,
} from "@/lib/actions/usage-limits";
import { maybeNaturalizeCoachReply } from "@/lib/ai/albanian-naturalize";
import { buildWatchAlexSystemPrompt } from "@/lib/ai/fitness-chat";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { isAiConfigured, runChatCompletion } from "@/lib/ai/providers";
import type { Profile } from "@/lib/types";
import { transcribeAudioBytes } from "@/lib/ai/transcribe-audio";
import {
  isCardioDurationComplete,
  minCardioSecondsForComplete,
} from "@/lib/cardio-completion";
import { cardioTaskId } from "@/lib/cardio-task-id";
import {
  readCardioTimer,
  remoteCardioElapsedMs,
  writeCardioTimer,
  type RemoteCardioTimer,
} from "@/lib/cardio-timer-db";
import { resolveExerciseGifUrl } from "@/lib/exercise-gif";
import { buildHiitPhases, isIntervalPlan, normalizeHiitConfig } from "@/lib/hiit";
import { sumMealMacros } from "@/lib/meal-utils";
import { workoutTaskId } from "@/lib/workout-task-id";
import type { WatchContext } from "@/lib/watch/auth";
import { watchDateKey } from "@/lib/watch/auth";

export type WatchWorkoutStatus = "none" | "scheduled" | "in_progress" | "completed";

export type WatchToday = {
  date: string;
  locale: "en" | "al";
  workout: {
    title: string | null;
    status: WatchWorkoutStatus;
    canLogSets: boolean;
    sessionId: string | null;
    exerciseName: string | null;
    setNumber: number | null;
    setId: string | null;
    targetReps: string | null;
    exercises: WatchExercise[];
    mode: "strength" | "interval";
    phases: WatchHiitPhase[];
  };
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    meals: { id: string; name: string; calories: number }[];
  };
  steps: { goal: number };
  water: { ml: number; goalMl: number };
  cardio: {
    id: string | null;
    title: string | null;
    plannedMinutes: number | null;
    status: "none" | "idle" | "running" | "paused" | "completed";
    elapsedSeconds: number;
    completed: boolean;
  };
};

type WatchResult = { today: WatchToday; message?: string } | { error: string; status?: number };

export type WatchExercise = {
  id: string;
  name: string;
  gifUrl: string | null;
  targetReps: string | null;
  setCount: number;
  completedSets: number;
  openSetId: string | null;
  openSetNumber: number | null;
  lastWeightKg: number | null;
  lastReps: number | null;
  videoUrl: string | null;
  sets: WatchSet[];
};

export type WatchSet = {
  id: string;
  number: number;
  done: boolean;
};

export type WatchHiitPhase = {
  type: string;
  seconds: number;
  label: string;
  name: string | null;
  gifUrl: string | null;
};

const WATCH_ORIGIN = "https://rutina.al";

type PlanExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes: string | null;
  image_url: string | null;
  video_url: string | null;
  order_index: number;
};

type SessionSet = {
  id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
};

type SessionExercise = {
  id: string;
  exercise_id: string | null;
  name: string;
  target_reps: string | null;
  order_index: number;
  workout_session_sets: SessionSet[] | null;
};

type ScheduledRow = {
  id: string;
  plan_id: string | null;
  day_id: string | null;
  order_index: number | null;
  workout_days:
    | {
        title: string | null;
        exercises: PlanExercise[] | null;
      }
    | {
        title: string | null;
        exercises: PlanExercise[] | null;
      }[]
    | null;
  workout_plans:
    | { title: string | null; kind: string | null; hiit_config?: unknown }
    | { title: string | null; kind: string | null; hiit_config?: unknown }[]
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/day/nutrition");
}

export async function loadWatchToday(
  ctx: WatchContext,
  date: string
): Promise<WatchToday> {
  const { admin, userId, profile } = ctx;
  const locale = profile.preferred_locale === "en" ? "en" : "al";

  const [scheduledResult, sessionResult, mealsResult, logResult, completionsResult, cardioResult] =
    await Promise.all([
      admin
        .from("scheduled_workouts")
        .select(
          "id, plan_id, day_id, order_index, workout_days(title, exercises(id, name, sets, reps, notes, image_url, video_url, order_index)), workout_plans(title, kind, hiit_config)"
        )
        .eq("client_id", userId)
        .eq("scheduled_date", date)
        .order("order_index"),
      admin
        .from("workout_sessions")
        .select(
          "id, plan_id, day_id, scheduled_workout_id, day_title, plan_title, status, started_at"
        )
        .eq("client_id", userId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("daily_meal_logs")
        .select("id, name, calories, protein, carbs, fat")
        .eq("client_id", userId)
        .eq("date", date)
        .order("logged_at", { ascending: true }),
      admin
        .from("daily_logs")
        .select("water_ml")
        .eq("client_id", userId)
        .eq("date", date)
        .maybeSingle(),
      admin
        .from("schedule_task_completions")
        .select("task_id, elapsed_seconds")
        .eq("client_id", userId)
        .eq("date", date),
      admin
        .from("scheduled_cardio")
        .select("cardio_id, client_cardio(id, title, duration_minutes)")
        .eq("client_id", userId)
        .eq("scheduled_date", date)
        .order("order_index")
        .limit(1)
        .maybeSingle(),
    ]);

  const scheduled = (scheduledResult.data ?? []) as ScheduledRow[];
  const completedTaskIds = new Set(
    (completionsResult.data ?? []).map((row) => row.task_id as string)
  );
  const nextScheduled = scheduled.find((row) => {
    const taskId = workoutTaskId(date, row.id);
    return !completedTaskIds.has(taskId);
  });
  const allScheduledDone =
    scheduled.length > 0 &&
    scheduled.every((row) => completedTaskIds.has(workoutTaskId(date, row.id)));

  const session = sessionResult.data;
  let exercises: SessionExercise[] = [];
  if (session?.id && session.started_at) {
    const { data } = await admin
      .from("workout_session_exercises")
      .select(
        "id, exercise_id, name, target_reps, order_index, workout_session_sets(id, set_number, reps, weight_kg, completed)"
      )
      .eq("session_id", session.id)
      .order("order_index");
    exercises = (data ?? []) as SessionExercise[];
  }

  const open = currentOpenSet(exercises);
  const workoutTitle =
    session?.day_title ||
    session?.plan_title ||
    one(nextScheduled?.workout_days)?.title ||
    one(nextScheduled?.workout_plans)?.title ||
    one(scheduled[0]?.workout_days)?.title ||
    null;

  let workoutStatus: WatchWorkoutStatus = "none";
  if (session) workoutStatus = "in_progress";
  else if (allScheduledDone) workoutStatus = "completed";
  else if (nextScheduled) workoutStatus = "scheduled";

  const mealRows = (mealsResult.data ?? []) as Array<{
    id: string;
    name: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }>;
  const macros = sumMealMacros(mealRows);
  const cardioRow = cardioResult.data as {
    cardio_id: string | null;
    client_cardio:
      | { id: string; title: string; duration_minutes: number | null }
      | { id: string; title: string; duration_minutes: number | null }[]
      | null;
  } | null;
  const cardio = one(cardioRow?.client_cardio);
  const cardioId = cardio?.id ?? cardioRow?.cardio_id ?? null;
  const cardioTask = cardioId ? cardioTaskId(date, cardioId) : null;
  const cardioCompletion = (completionsResult.data ?? []).find(
    (row) => row.task_id === cardioTask
  );
  let cardioTimer: RemoteCardioTimer | null = null;
  if (cardioId) {
    const read = await readCardioTimer(admin, userId, date, cardioId);
    if ("timer" in read) cardioTimer = read.timer;
  }

  const cardioCompleted = Boolean(cardioCompletion);
  let cardioStatus: WatchToday["cardio"]["status"] = "none";
  if (!cardioId) cardioStatus = "none";
  else if (cardioCompleted) cardioStatus = "completed";
  else if (cardioTimer && cardioTimer.status !== "idle") cardioStatus = cardioTimer.status;
  else cardioStatus = "idle";

  const elapsedSeconds = cardioCompleted
    ? Number(cardioCompletion?.elapsed_seconds ?? 0)
    : cardioTimer
      ? Math.floor(remoteCardioElapsedMs(cardioTimer) / 1000)
      : 0;

  return {
    date,
    locale,
    workout: {
      title: workoutTitle,
      status: workoutStatus,
      canLogSets: exercises.length > 0,
      sessionId: session?.id ?? null,
      exerciseName: open?.exerciseName ?? null,
      setNumber: open?.setNumber ?? null,
      setId: open?.setId ?? null,
      targetReps: open?.targetReps ?? null,
      exercises: watchExercises(exercises, planExercisesFor(scheduled, session?.day_id, nextScheduled)),
      ...watchInterval(
        planFor(scheduled, session?.day_id, nextScheduled),
        planExercisesFor(scheduled, session?.day_id, nextScheduled)
      ),
    },
    nutrition: {
      calories: Math.round(macros.calories),
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fat: Math.round(macros.fat),
      targetCalories: profile.target_calories ?? 2000,
      targetProtein: profile.target_protein ?? 150,
      targetCarbs: profile.target_carbs ?? 200,
      targetFat: profile.target_fat ?? 65,
      meals: mealRows.map((meal) => ({
        id: meal.id,
        name: meal.name?.trim() || "Meal",
        calories: Math.round(Number(meal.calories) || 0),
      })),
    },
    steps: { goal: profile.step_goal ?? 10000 },
    water: {
      ml: logResult.data?.water_ml ?? 0,
      goalMl: profile.water_goal_ml ?? 2500,
    },
    cardio: {
      id: cardioId,
      title: cardio?.title ?? null,
      plannedMinutes: cardio?.duration_minutes ?? null,
      status: cardioStatus,
      elapsedSeconds,
      completed: cardioCompleted,
    },
  };
}

function planFor(
  scheduled: ScheduledRow[],
  dayId: string | null | undefined,
  nextScheduled: ScheduledRow | undefined
) {
  const match = dayId ? scheduled.find((row) => row.day_id === dayId) : null;
  return (
    one(match?.workout_plans) ??
    one(nextScheduled?.workout_plans) ??
    one(scheduled[0]?.workout_plans)
  );
}

function planExercisesFor(
  scheduled: ScheduledRow[],
  dayId: string | null | undefined,
  nextScheduled: ScheduledRow | undefined
): PlanExercise[] {
  const match = dayId ? scheduled.find((row) => row.day_id === dayId) : null;
  return (
    one(match?.workout_days)?.exercises ??
    one(nextScheduled?.workout_days)?.exercises ??
    one(scheduled[0]?.workout_days)?.exercises ??
    []
  );
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function watchVideoUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return /\.(mp4|mov|m4v)(\?|$)/i.test(trimmed) ? trimmed : null;
}

function watchInterval(
  plan: { kind?: string | null; hiit_config?: unknown } | null,
  planExercises: PlanExercise[]
): { mode: "strength" | "interval"; phases: WatchHiitPhase[] } {
  const config = normalizeHiitConfig(plan?.hiit_config);
  if (!plan || !config || !isIntervalPlan(plan)) {
    return { mode: "strength", phases: [] };
  }
  const phases = buildHiitPhases(config)
    .filter((phase) => phase.type !== "done" && phase.durationSeconds > 0)
    .map((phase) => {
      const named = phase.exerciseName?.trim().toLowerCase() ?? "";
      const planned = planExercises.find((exercise) => exercise.name.trim().toLowerCase() === named);
      const fromConfig = config.exercises.find(
        (exercise) => exercise.name.trim().toLowerCase() === named
      );
      return {
        type: phase.type,
        seconds: phase.durationSeconds,
        label: phase.label,
        name: phase.exerciseName ?? phase.label,
        gifUrl: named
          ? watchGifUrl(phase.exerciseName ?? "", fromConfig?.image_url ?? planned?.image_url ?? null)
          : null,
      };
    });
  return { mode: "interval", phases };
}

function watchGifUrl(name: string, imageUrl: string | null): string | null {
  const resolved = resolveExerciseGifUrl({ name, imageUrl });
  if (!resolved) return null;
  if (resolved.startsWith("https://") || resolved.startsWith("http://")) return resolved;
  return `${WATCH_ORIGIN}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

function watchExercises(
  sessionExercises: SessionExercise[],
  planExercises: PlanExercise[]
): WatchExercise[] {
  const imageById = new Map(planExercises.map((exercise) => [exercise.id, exercise.image_url ?? null]));
  const imageByName = new Map(
    planExercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise.image_url ?? null])
  );

  if (sessionExercises.length > 0) {
    return [...sessionExercises]
      .sort((a, b) => a.order_index - b.order_index)
      .map((exercise) => {
        const sets = [...(exercise.workout_session_sets ?? [])].sort(
          (a, b) => a.set_number - b.set_number
        );
        const open = sets.find((set) => !set.completed) ?? null;
        const previous = [...sets].reverse().find((set) => set.completed) ?? null;
        const image =
          (exercise.exercise_id ? imageById.get(exercise.exercise_id) : null) ??
          imageByName.get(exercise.name.trim().toLowerCase()) ??
          null;
        const planned = planExercises.find(
          (item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase()
        );
        return {
          id: exercise.id,
          name: exercise.name,
          gifUrl: watchGifUrl(exercise.name, image),
          videoUrl: watchVideoUrl(planned?.video_url),
          targetReps: exercise.target_reps,
          setCount: Math.max(sets.length, 1),
          completedSets: sets.filter((set) => set.completed).length,
          openSetId: open?.id ?? null,
          openSetNumber: open?.set_number ?? null,
          lastWeightKg: asNumber(open?.weight_kg ?? previous?.weight_kg),
          lastReps: (() => {
            const reps = asNumber(open?.reps ?? previous?.reps);
            return reps == null ? null : Math.round(reps);
          })(),
          sets: sets.map((set) => ({
            id: set.id,
            number: set.set_number,
            done: set.completed,
          })),
        };
      });
  }

  return [...planExercises]
    .sort((a, b) => a.order_index - b.order_index)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      gifUrl: watchGifUrl(exercise.name, exercise.image_url ?? null),
      videoUrl: watchVideoUrl(exercise.video_url),
      targetReps: exercise.reps,
      setCount: exercise.sets,
      completedSets: 0,
      openSetId: null,
      openSetNumber: null,
      lastWeightKg: null,
      lastReps: null,
      sets: [],
    }));
}

function currentOpenSet(exercises: SessionExercise[]) {
  const ordered = [...exercises].sort((a, b) => a.order_index - b.order_index);
  for (const exercise of ordered) {
    const sets = [...(exercise.workout_session_sets ?? [])].sort(
      (a, b) => a.set_number - b.set_number
    );
    const open = sets.find((set) => !set.completed);
    if (open) {
      return {
        exerciseName: exercise.name,
        setNumber: open.set_number,
        setId: open.id,
        targetReps: exercise.target_reps,
      };
    }
  }
  return null;
}

async function seedSession(
  ctx: WatchContext,
  sessionId: string,
  planId: string,
  dayId: string
) {
  const { admin } = ctx;
  const { count } = await admin
    .from("workout_session_exercises")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if ((count ?? 0) > 0) return;

  const { data: day } = await admin
    .from("workout_days")
    .select("exercises(id, name, sets, reps, notes, order_index)")
    .eq("id", dayId)
    .eq("plan_id", planId)
    .maybeSingle();

  const exercises = ((day?.exercises as PlanExercise[] | null) ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index);
  if (exercises.length === 0) return;

  const { data: inserted } = await admin
    .from("workout_session_exercises")
    .insert(
      exercises.map((exercise, index) => ({
        session_id: sessionId,
        exercise_id: exercise.id,
        name: exercise.name,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        order_index: index,
        notes: exercise.notes,
      }))
    )
    .select("id, target_sets, order_index");

  const setRows = (inserted ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((exercise) =>
      Array.from({ length: exercise.target_sets }, (_, index) => ({
        session_exercise_id: exercise.id,
        set_number: index + 1,
        completed: false,
      }))
    );
  if (setRows.length > 0) {
    await admin.from("workout_session_sets").insert(setRows);
  }
}

export async function startWatchWorkout(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const { admin, userId } = ctx;
  const { data: existing } = await admin
    .from("workout_sessions")
    .select("id, plan_id, day_id, scheduled_date, scheduled_workout_id, started_at, status")
    .eq("client_id", userId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: scheduledRows } = await admin
    .from("scheduled_workouts")
    .select("id, plan_id, day_id")
    .eq("client_id", userId)
    .eq("scheduled_date", date)
    .order("order_index");

  const { data: doneRows } = await admin
    .from("schedule_task_completions")
    .select("task_id")
    .eq("client_id", userId)
    .eq("date", date);
  const done = new Set((doneRows ?? []).map((row) => row.task_id as string));
  const target = (scheduledRows ?? []).find(
    (row) => row.plan_id && row.day_id && !done.has(workoutTaskId(date, row.id))
  );

  if (existing) {
    const sameDay =
      !target ||
      existing.scheduled_workout_id === target.id ||
      (existing.plan_id === target.plan_id &&
        existing.day_id === target.day_id &&
        (existing.scheduled_date ?? date) === date);
    if (!sameDay) {
      return {
        error: "Finish the workout already in progress on your phone.",
      };
    }
    if (!existing.started_at) {
      await admin
        .from("workout_sessions")
        .update({ started_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("client_id", userId);
    }
    if (existing.plan_id && existing.day_id) {
      await seedSession(ctx, existing.id, existing.plan_id, existing.day_id);
    }
    revalidateDashboard();
    return { today: await loadWatchToday(ctx, date) };
  }

  if (!target?.plan_id || !target.day_id) {
    return { error: "No workout scheduled today." };
  }

  const { data: day } = await admin
    .from("workout_days")
    .select("title, workout_plans(title)")
    .eq("id", target.day_id)
    .eq("plan_id", target.plan_id)
    .maybeSingle();
  if (!day) return { error: "Workout not found." };

  const planTitle =
    one(day.workout_plans as { title: string | null } | { title: string | null }[] | null)
      ?.title ?? "Workout";

  const { data: session, error } = await admin
    .from("workout_sessions")
    .insert({
      client_id: userId,
      plan_id: target.plan_id,
      day_id: target.day_id,
      scheduled_date: date,
      scheduled_workout_id: target.id,
      day_title: day.title,
      plan_title: planTitle,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) {
    return { error: error?.message ?? "Could not start the workout." };
  }

  await seedSession(ctx, session.id, target.plan_id, target.day_id);
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function cancelWatchWorkout(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const { admin, userId } = ctx;
  const { data: session } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return { error: "No workout is in progress." };

  const { error } = await admin
    .from("workout_sessions")
    .update({ status: "cancelled" })
    .eq("id", session.id)
    .eq("client_id", userId)
    .eq("status", "in_progress");
  if (error) return { error: error.message };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function logWatchSet(
  ctx: WatchContext,
  date: string,
  setId: string,
  reps: number,
  weightKg: number
): Promise<WatchResult> {
  if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
    return { error: "Reps must be between 1 and 100." };
  }
  if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500) {
    return { error: "Weight must be between 0 and 500 kg." };
  }

  const { admin, userId } = ctx;
  const { data: setRow } = await admin
    .from("workout_session_sets")
    .select("id, session_exercise_id")
    .eq("id", setId)
    .maybeSingle();
  if (!setRow) return { error: "Set not found." };

  const { data: exercise } = await admin
    .from("workout_session_exercises")
    .select("session_id")
    .eq("id", setRow.session_exercise_id)
    .maybeSingle();
  if (!exercise) return { error: "Set not found." };

  const { data: session } = await admin
    .from("workout_sessions")
    .select("client_id, status, started_at")
    .eq("id", exercise.session_id)
    .maybeSingle();
  if (!session || session.client_id !== userId) return { error: "Set not found." };
  if (session.status !== "in_progress" || !session.started_at) {
    return { error: "Start the workout before logging a set." };
  }

  const { error } = await admin
    .from("workout_session_sets")
    .update({
      reps: Math.round(reps),
      weight_kg: Math.round(weightKg * 10) / 10,
      completed: true,
    })
    .eq("id", setId);
  if (error) return { error: error.message };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function addWatchWater(
  ctx: WatchContext,
  date: string,
  amount: number
): Promise<WatchResult> {
  if (amount !== 250 && amount !== 500 && amount !== -250) {
    return { error: "Use 250 or 500 ml." };
  }
  const { error } = await ctx.admin.rpc("increment_water_ml", {
    p_user_id: ctx.userId,
    p_date: date,
    p_amount: amount,
  });
  if (error) return { error: error.message };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

async function todayCardio(ctx: WatchContext, date: string) {
  const { data } = await ctx.admin
    .from("scheduled_cardio")
    .select("cardio_id, client_cardio(id, title, duration_minutes)")
    .eq("client_id", ctx.userId)
    .eq("scheduled_date", date)
    .order("order_index")
    .limit(1)
    .maybeSingle();
  const row = data as {
    cardio_id: string | null;
    client_cardio:
      | { id: string; title: string; duration_minutes: number | null }
      | { id: string; title: string; duration_minutes: number | null }[]
      | null;
  } | null;
  const cardio = one(row?.client_cardio);
  const id = cardio?.id ?? row?.cardio_id ?? null;
  if (!id) return null;
  return {
    id,
    title: cardio?.title ?? "Cardio",
    plannedMinutes: cardio?.duration_minutes ?? null,
  };
}

export async function startWatchCardio(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const cardio = await todayCardio(ctx, date);
  if (!cardio) return { error: "No cardio scheduled today." };

  const current = await readCardioTimer(ctx.admin, ctx.userId, date, cardio.id);
  if ("error" in current) return { error: current.error };
  if (current.timer.status === "running") {
    return { today: await loadWatchToday(ctx, date) };
  }

  const written = await writeCardioTimer(ctx.admin, ctx.userId, {
    date,
    cardioId: cardio.id,
    status: "running",
    accumulatedMs: current.timer.accumulatedMs,
    segmentStartedAt: new Date().toISOString(),
  });
  if ("error" in written) return { error: written.error };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function stopWatchCardio(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const cardio = await todayCardio(ctx, date);
  if (!cardio) return { error: "No cardio scheduled today." };

  const current = await readCardioTimer(ctx.admin, ctx.userId, date, cardio.id);
  if ("error" in current) return { error: current.error };
  if (current.timer.status === "idle") {
    return { error: "Cardio isn't running." };
  }

  const elapsedSeconds = Math.floor(remoteCardioElapsedMs(current.timer) / 1000);
  if (!isCardioDurationComplete(elapsedSeconds, cardio.plannedMinutes)) {
    const paused = await writeCardioTimer(ctx.admin, ctx.userId, {
      date,
      cardioId: cardio.id,
      status: "paused",
      accumulatedMs: elapsedSeconds * 1000,
      segmentStartedAt: null,
    });
    if ("error" in paused) return { error: paused.error };
    const remaining = Math.max(
      0,
      minCardioSecondsForComplete(cardio.plannedMinutes) - elapsedSeconds
    );
    const minutes = Math.ceil(remaining / 60);
    revalidateDashboard();
    return {
      today: await loadWatchToday(ctx, date),
      message: `Paused. About ${minutes} min left to count it.`,
    };
  }

  const completedAt = new Date().toISOString();
  const taskId = cardioTaskId(date, cardio.id);
  let { error } = await ctx.admin.from("schedule_task_completions").upsert(
    {
      client_id: ctx.userId,
      date,
      task_id: taskId,
      completed_at: completedAt,
      elapsed_seconds: elapsedSeconds,
    },
    { onConflict: "client_id,date,task_id" }
  );
  if (error && /elapsed_seconds/i.test(error.message)) {
    const fallback = await ctx.admin.from("schedule_task_completions").upsert(
      {
        client_id: ctx.userId,
        date,
        task_id: taskId,
        completed_at: completedAt,
      },
      { onConflict: "client_id,date,task_id" }
    );
    error = fallback.error;
  }
  if (error) return { error: error.message };

  const cleared = await writeCardioTimer(ctx.admin, ctx.userId, {
    date,
    cardioId: cardio.id,
    status: "idle",
    accumulatedMs: 0,
    segmentStartedAt: null,
  });
  if ("error" in cleared) return { error: cleared.error };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date), message: "Cardio saved." };
}

export async function pauseWatchCardio(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const cardio = await todayCardio(ctx, date);
  if (!cardio) return { error: "No cardio scheduled today." };
  const current = await readCardioTimer(ctx.admin, ctx.userId, date, cardio.id);
  if ("error" in current) return { error: current.error };
  if (current.timer.status !== "running") {
    return { today: await loadWatchToday(ctx, date) };
  }
  const elapsedSeconds = Math.floor(remoteCardioElapsedMs(current.timer) / 1000);
  const paused = await writeCardioTimer(ctx.admin, ctx.userId, {
    date,
    cardioId: cardio.id,
    status: "paused",
    accumulatedMs: elapsedSeconds * 1000,
    segmentStartedAt: null,
  });
  if ("error" in paused) return { error: paused.error };
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function resetWatchCardio(
  ctx: WatchContext,
  date: string
): Promise<WatchResult> {
  const cardio = await todayCardio(ctx, date);
  if (!cardio) return { error: "No cardio scheduled today." };
  const cleared = await writeCardioTimer(ctx.admin, ctx.userId, {
    date,
    cardioId: cardio.id,
    status: "idle",
    accumulatedMs: 0,
    segmentStartedAt: null,
  });
  if ("error" in cleared) return { error: cleared.error };
  await ctx.admin
    .from("schedule_task_completions")
    .delete()
    .eq("client_id", ctx.userId)
    .eq("date", date)
    .eq("task_id", cardioTaskId(date, cardio.id));
  revalidateDashboard();
  return { today: await loadWatchToday(ctx, date) };
}

export async function askWatchAlex(
  ctx: WatchContext,
  date: string,
  message: string,
  context?: string
): Promise<{ reply: string } | { error: string; status?: number }> {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Say something first." };
  if (trimmed.length > 500) return { error: "Keep it shorter for the Watch." };
  if (!isAiConfigured()) {
    return { error: "Alex isn't available right now.", status: 503 };
  }

  const access = await checkAlexCommandAllowed(ctx.profile);
  if (!access.allowed) return { error: access.error, status: 403 };

  const snapshot = context?.trim().slice(0, 500) || "";

  try {
    const [{ data: fullProfile }, { data: meals }, today] = await Promise.all([
      ctx.admin.from("profiles").select("*").eq("id", ctx.userId).maybeSingle(),
      ctx.admin
        .from("daily_meal_logs")
        .select("name, calories, protein, carbs, fat")
        .eq("client_id", ctx.userId)
        .eq("date", date),
      loadWatchToday(ctx, date),
    ]);
    const profile = (fullProfile as Profile | null) ?? ctx.profile;
    let intake = "";
    try {
      intake = buildIntakeContextForAi(profile);
    } catch {
      intake = `Name: ${profile.full_name ?? "Client"}. Targets: ${profile.target_calories ?? 0} kcal, ${profile.target_protein ?? 0}g protein.`;
    }
    const mealLines =
      (meals ?? [])
        .map((meal) => {
          const name = typeof meal.name === "string" && meal.name.trim() ? meal.name.trim() : "Meal";
          return `- ${name}: ${Math.round(Number(meal.calories) || 0)} kcal, ${Math.round(Number(meal.protein) || 0)}g protein, ${Math.round(Number(meal.carbs) || 0)}g carbs, ${Math.round(Number(meal.fat) || 0)}g fat`;
        })
        .join("\n") || "  (none logged yet today)";
    const todayBlock = [
      "TODAY (ground truth):",
      `- Workout: ${today.workout.title ?? "rest day"} (${today.workout.status})`,
      `- Calories: ${today.nutrition.calories}/${today.nutrition.targetCalories} kcal`,
      `- Protein: ${today.nutrition.protein}/${today.nutrition.targetProtein}g`,
      `- Carbs: ${today.nutrition.carbs}/${today.nutrition.targetCarbs}g`,
      `- Fat: ${today.nutrition.fat}/${today.nutrition.targetFat}g`,
      `- Water: ${today.water.ml}/${today.water.goalMl} ml`,
      `- Cardio: ${today.cardio.title ?? "none"} (${today.cardio.status})`,
      "TODAY'S LOGGED MEALS:",
      mealLines,
      snapshot ? `Watch screen right now: ${snapshot}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const draft = await runChatCompletion(
      [
        {
          role: "system",
          content: buildWatchAlexSystemPrompt({
            intakeContext: intake,
            todayBlock,
            preferredLocale: profile.preferred_locale,
          }),
        },
        { role: "user", content: trimmed },
      ],
      { maxTokens: 120, tier: "cheap" }
    );
    const reply = await maybeNaturalizeCoachReply(draft, profile.preferred_locale, {
      maxTokens: 180,
    });
    await consumeAlexCommand(ctx.profile);
    return { reply: reply.trim() };
  } catch (error) {
    const text = error instanceof Error ? error.message : "Alex couldn't answer.";
    return { error: text, status: 500 };
  }
}

export async function askWatchAlexFromAudio(
  ctx: WatchContext,
  date: string,
  audioBase64: string,
  context?: string
): Promise<{ reply: string } | { error: string; status?: number }> {
  const cleaned = audioBase64.replace(/\s/g, "");
  if (!cleaned) return { error: "No audio received." };
  let bytes: Buffer;
  try {
    bytes = Buffer.from(cleaned, "base64");
  } catch {
    return { error: "Couldn't read that recording." };
  }
  const language = ctx.profile.preferred_locale === "en" ? "en" : "sq";
  const transcript = await transcribeAudioBytes({
    bytes,
    filename: "watch.m4a",
    mimeType: "audio/m4a",
    language,
    fast: true,
  });
  if ("error" in transcript) return { error: transcript.error, status: 500 };
  return askWatchAlex(ctx, date, transcript.text, context);
}

export type LiveWorkoutCard = {
  active: boolean;
  exerciseName: string;
  exerciseIndex: number;
  exerciseCount: number;
  gifUrl: string | null;
  setId: string | null;
  setNumber: number;
  setCount: number;
  reps: number;
  weightKg: number;
};

function suggestedLiveReps(target: string | null): number {
  const match = target?.match(/\d+/);
  const reps = match ? Number(match[0]) : 8;
  if (!Number.isFinite(reps) || reps < 1) return 8;
  return Math.min(40, Math.round(reps));
}

function liveCard(
  exercise: WatchExercise,
  index: number,
  count: number
): LiveWorkoutCard {
  return {
    active: true,
    exerciseName: exercise.name,
    exerciseIndex: index,
    exerciseCount: count,
    gifUrl: exercise.gifUrl,
    setId: exercise.openSetId,
    setNumber: exercise.openSetNumber ?? Math.min(exercise.completedSets + 1, exercise.setCount),
    setCount: exercise.setCount,
    reps: exercise.lastReps ?? suggestedLiveReps(exercise.targetReps),
    weightKg: exercise.lastWeightKg ?? 20,
  };
}

const inactiveLiveCard: LiveWorkoutCard = {
  active: false,
  exerciseName: "",
  exerciseIndex: 0,
  exerciseCount: 0,
  gifUrl: null,
  setId: null,
  setNumber: 0,
  setCount: 0,
  reps: 8,
  weightKg: 20,
};

/** The set the Lock Screen and back-tap sheet should show for an in-progress workout. */
export async function loadLiveWorkout(
  ctx: WatchContext,
  date: string,
  exerciseIndex: number | null,
  advance: boolean
): Promise<{ live: LiveWorkoutCard }> {
  const today = await loadWatchToday(ctx, date);
  const exercises = today.workout.exercises;
  if (
    today.workout.status !== "in_progress" ||
    today.workout.mode !== "strength" ||
    !today.workout.canLogSets ||
    exercises.length === 0
  ) {
    return { live: inactiveLiveCard };
  }

  let index =
    exerciseIndex == null || !Number.isFinite(exerciseIndex)
      ? exercises.findIndex((exercise) => exercise.openSetId)
      : Math.min(Math.max(Math.round(exerciseIndex), 0), exercises.length - 1);
  if (index < 0) index = 0;

  if (advance && !exercises[index]?.openSetId) {
    const next = exercises.findIndex(
      (exercise, exerciseIndex) => exerciseIndex > index && exercise.openSetId
    );
    const any = exercises.findIndex((exercise) => exercise.openSetId);
    if (next >= 0) index = next;
    else if (any >= 0) index = any;
    else return { live: inactiveLiveCard };
  }

  const exercise = exercises[index];
  if (!exercise) return { live: inactiveLiveCard };
  return { live: liveCard(exercise, index, exercises.length) };
}

export async function handleWatchAction(
  ctx: WatchContext,
  body: {
    action?: string;
    date?: unknown;
    setId?: unknown;
    reps?: unknown;
    weightKg?: unknown;
    amount?: unknown;
    message?: unknown;
    audioBase64?: unknown;
    context?: unknown;
    exerciseIndex?: unknown;
    advance?: unknown;
  }
): Promise<
  | WatchResult
  | { reply: string }
  | { live: LiveWorkoutCard }
  | { error: string; status?: number }
> {
  const date = watchDateKey(body.date);
  switch (body.action) {
    case "today":
      return { today: await loadWatchToday(ctx, date) };
    case "workout.start":
      return startWatchWorkout(ctx, date);
    case "workout.cancel":
      return cancelWatchWorkout(ctx, date);
    case "workout.live": {
      const raw = Number(body.exerciseIndex);
      return loadLiveWorkout(
        ctx,
        date,
        Number.isFinite(raw) ? raw : null,
        body.advance === true
      );
    }
    case "workout.logSet":
      return logWatchSet(
        ctx,
        date,
        typeof body.setId === "string" ? body.setId : "",
        Number(body.reps),
        Number(body.weightKg)
      );
    case "water.add":
      return addWatchWater(ctx, date, Number(body.amount));
    case "cardio.start":
      return startWatchCardio(ctx, date);
    case "cardio.pause":
      return pauseWatchCardio(ctx, date);
    case "cardio.reset":
      return resetWatchCardio(ctx, date);
    case "cardio.stop":
      return stopWatchCardio(ctx, date);
    case "alex":
      return askWatchAlex(
        ctx,
        date,
        typeof body.message === "string" ? body.message : "",
        typeof body.context === "string" ? body.context : undefined
      );
    case "alex.audio":
      return askWatchAlexFromAudio(
        ctx,
        date,
        typeof body.audioBase64 === "string" ? body.audioBase64 : "",
        typeof body.context === "string" ? body.context : undefined
      );
    default:
      return { error: "Unknown action.", status: 400 };
  }
}
