import { revalidatePath } from "next/cache";
import {
  checkAlexCommandAllowed,
  consumeAlexCommand,
} from "@/lib/actions/usage-limits";
import { isAiConfigured, runChatCompletion } from "@/lib/ai/providers";
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

type PlanExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes: string | null;
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
    | { title: string | null; kind: string | null }
    | { title: string | null; kind: string | null }[]
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
          "id, plan_id, day_id, order_index, workout_days(title, exercises(id, name, sets, reps, notes, order_index)), workout_plans(title, kind)"
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
        .select("calories, protein, carbs, fat")
        .eq("client_id", userId)
        .eq("date", date),
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
        "id, name, target_reps, order_index, workout_session_sets(id, set_number, reps, weight_kg, completed)"
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

  const macros = sumMealMacros(mealsResult.data ?? []);
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
  if (amount !== 250 && amount !== 500) {
    return { error: "Add 250 or 500 ml." };
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

export async function askWatchAlex(
  ctx: WatchContext,
  date: string,
  message: string
): Promise<{ reply: string } | { error: string; status?: number }> {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Say something first." };
  if (trimmed.length > 500) return { error: "Keep it shorter for the Watch." };
  if (!isAiConfigured()) {
    return { error: "Alex isn't available right now.", status: 503 };
  }

  const access = await checkAlexCommandAllowed(ctx.profile);
  if (!access.allowed) return { error: access.error, status: 403 };

  const today = await loadWatchToday(ctx, date);
  const lang = today.locale === "al" ? "Albanian" : "English";
  const snapshot = [
    `Workout: ${today.workout.title ?? "none"} (${today.workout.status})`,
    today.workout.exerciseName
      ? `Current set: ${today.workout.exerciseName} set ${today.workout.setNumber}`
      : null,
    `Nutrition: ${today.nutrition.calories}/${today.nutrition.targetCalories} kcal, P ${today.nutrition.protein}/${today.nutrition.targetProtein}g, C ${today.nutrition.carbs}/${today.nutrition.targetCarbs}g, F ${today.nutrition.fat}/${today.nutrition.targetFat}g`,
    `Water: ${today.water.ml}/${today.water.goalMl} ml`,
    `Steps goal: ${today.steps.goal}`,
    today.cardio.title
      ? `Cardio: ${today.cardio.title} ${today.cardio.status}, ${today.cardio.elapsedSeconds}s`
      : "Cardio: none",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const reply = await runChatCompletion(
      [
        {
          role: "system",
          content: `You are Coach Alex inside the RUTINA Apple Watch. Reply in ${lang}. Two to four short sentences. No markdown, no bullet lists. Be direct and a little sharp, never cruel. Use today's snapshot. Do not claim you changed their plan, logged a set, or saved a meal.\n\n${snapshot}`,
        },
        { role: "user", content: trimmed },
      ],
      { maxTokens: 220, tier: "cheap" }
    );
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
  audioBase64: string
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
  });
  if ("error" in transcript) return { error: transcript.error, status: 500 };
  return askWatchAlex(ctx, date, transcript.text);
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
  }
): Promise<
  | WatchResult
  | { reply: string }
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
    case "cardio.stop":
      return stopWatchCardio(ctx, date);
    case "alex":
      return askWatchAlex(
        ctx,
        date,
        typeof body.message === "string" ? body.message : ""
      );
    case "alex.audio":
      return askWatchAlexFromAudio(
        ctx,
        date,
        typeof body.audioBase64 === "string" ? body.audioBase64 : ""
      );
    default:
      return { error: "Unknown action.", status: 400 };
  }
}
