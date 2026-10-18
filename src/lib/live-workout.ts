"use client";

import { useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getWorkoutSession } from "@/lib/actions/workout-sessions";
import type { WorkoutSessionExercise } from "@/lib/types";
import { pushWorkoutMirror } from "@/lib/watch-session";

export type LiveBoardSet = {
  id: string;
  number: number;
  reps: number;
  weightKg: number;
  done: boolean;
};

export type LiveBoardExercise = {
  name: string;
  gifUrl?: string | null;
  sets: LiveBoardSet[];
  restSeconds: number;
};

export type LiveWorkoutPayload = {
  exerciseName: string;
  exerciseIndex: number;
  exerciseCount: number;
  gifUrl?: string | null;
  setId: string | null;
  setNumber: number;
  setCount: number;
  reps: number;
  weightKg: number;
  board?: LiveBoardExercise[];
};

type LiveSnapshot = {
  exerciseIndex: number;
  setId: string;
  reps: number;
  weightKg: number;
  revision: number;
  boardJson?: string;
  pendingJson?: string;
};

type LiveWorkoutPlugin = {
  sync(
    options: Omit<LiveWorkoutPayload, "board"> & {
      boardJson?: string;
      baseRevision?: number;
    }
  ): Promise<void>;
  end(): Promise<void>;
  flush(): Promise<void>;
  consumeQuickOpen(): Promise<{ open: boolean; exerciseIndex: number }>;
  currentDraft(): Promise<LiveSnapshot>;
};

const LiveWorkout = registerPlugin<LiveWorkoutPlugin>("LiveWorkout");

let liveToken = 0;
let liveSuppressed = false;
let liveBaseRevision = 0;
let liveRevisionReady = false;

function noteLiveRevision(revision: number) {
  liveBaseRevision = Number.isFinite(revision) ? Math.max(0, Math.round(revision)) : 0;
  liveRevisionReady = true;
}

function stopLivePublishing() {
  liveSuppressed = true;
  liveToken += 1;
}

function resumeLivePublishing() {
  liveSuppressed = false;
  liveToken += 1;
}

function onIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function absoluteGif(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${trimmed}`;
  }
  return null;
}

function clampReps(value: number): number {
  return Math.min(40, Math.max(1, Math.round(value) || 1));
}

function clampWeight(value: number): number {
  return Math.min(200, Math.max(0, Number(value) || 0));
}

export const DEFAULT_SET_REPS = 6;
export const DEFAULT_SET_KG = 10;

export function buildLiveBoard(
  exercises: WorkoutSessionExercise[],
  gifFor: (exercise: WorkoutSessionExercise) => string | null | undefined,
  current: { setId: string | null; reps: number; weightKg: number } | null
): LiveBoardExercise[] {
  return exercises.map((exercise) => {
    const sets = [...(exercise.sets ?? [])].sort((a, b) => a.set_number - b.set_number);
    const lastDone = [...sets].reverse().find((set) => set.completed);
    const fallbackReps = clampReps(lastDone?.reps ?? DEFAULT_SET_REPS);
    const fallbackWeight =
      lastDone?.weight_kg != null ? Number(lastDone.weight_kg) : DEFAULT_SET_KG;
    const plannedRest = exercise.rest_seconds;
    const restSeconds =
      plannedRest == null
        ? 90
        : Math.min(600, Math.max(0, Math.round(plannedRest)));
    return {
      name: exercise.name,
      gifUrl: gifFor(exercise) ?? null,
      restSeconds,
      sets: sets.map((set) => {
        const done = Boolean(set.completed);
        const isCurrent = !done && current?.setId === set.id;
        const reps = isCurrent ? current.reps : (set.reps ?? fallbackReps);
        const weightKg = isCurrent
          ? current.weightKg
          : set.weight_kg != null
            ? Number(set.weight_kg)
            : fallbackWeight;
        return {
          id: set.id,
          number: set.set_number,
          reps: clampReps(reps),
          weightKg: clampWeight(weightKg),
          done,
        };
      }),
    };
  });
}

function parseBoard(json: string | undefined): LiveBoardExercise[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { exercises?: LiveBoardExercise[] };
    return Array.isArray(parsed.exercises) ? parsed.exercises : [];
  } catch {
    return [];
  }
}

function pendingSets(json: string | undefined): LiveBoardSet[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { setId?: string; reps?: number; weightKg?: number }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((log) =>
      log.setId
        ? [
            {
              id: log.setId,
              number: 0,
              reps: clampReps(Number(log.reps) || 1),
              weightKg: clampWeight(Number(log.weightKg) || 0),
              done: true,
            },
          ]
        : []
    );
  } catch {
    return [];
  }
}

function mergeLiveBoard(
  exercises: WorkoutSessionExercise[],
  board: LiveBoardExercise[],
  pending: LiveBoardSet[] = []
): WorkoutSessionExercise[] {
  const logged = new Map<string, LiveBoardSet>();
  for (const exercise of board) {
    for (const set of exercise.sets) {
      if (set.done) logged.set(set.id, set);
    }
  }
  for (const set of pending) logged.set(set.id, set);
  if (logged.size === 0) return exercises;
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets?.map((set) => {
      if (set.completed) return set;
      const extra = logged.get(set.id);
      if (!extra) return set;
      return {
        ...set,
        completed: true,
        reps: extra.reps,
        weight_kg: extra.weightKg,
      };
    }),
  }));
}

function firstOpenExerciseIndex(
  exercises: WorkoutSessionExercise[],
  preferred: number
): number {
  const hasOpen = (exercise: WorkoutSessionExercise | undefined) =>
    Boolean(exercise?.sets?.some((set) => !set.completed));
  if (hasOpen(exercises[preferred])) return preferred;
  const index = exercises.findIndex((exercise) => hasOpen(exercise));
  if (index >= 0) return index;
  return Math.min(Math.max(preferred, 0), Math.max(exercises.length - 1, 0));
}

/** Push the current set to the Lock Screen card. No-op off the iPhone app. */
export async function syncLiveWorkout(
  payload: LiveWorkoutPayload,
  baseRevision = liveBaseRevision
): Promise<void> {
  if (!onIos() || liveSuppressed || !liveRevisionReady) return;
  const { board, ...rest } = payload;
  const boardJson = JSON.stringify({
    exercises: (board ?? []).map((exercise) => ({
      ...exercise,
      gifUrl: absoluteGif(exercise.gifUrl),
    })),
  });
  await LiveWorkout.sync({
    ...rest,
    gifUrl: absoluteGif(payload.gifUrl),
    reps: clampReps(payload.reps),
    weightKg: clampWeight(payload.weightKg),
    boardJson,
    baseRevision,
  }).catch(() => undefined);
  void pushWorkoutMirror({
    status: "live",
    action: "move",
    mode: "strength",
    exerciseIndex: payload.exerciseIndex,
    setId: payload.setId,
    reps: payload.reps,
    weightKg: payload.weightKg,
  });
}

export async function endLiveWorkout(): Promise<void> {
  stopLivePublishing();
  if (!onIos()) return;
  await LiveWorkout.end().catch(() => undefined);
}

/** Drops the Lock Screen card when no strength workout is in progress. */
export async function endLiveWorkoutIfIdle(): Promise<void> {
  if (!onIos()) return;
  const token = liveToken;
  try {
    const { getInProgressSession } = await import("@/lib/actions/workout-sessions");
    const session = await getInProgressSession();
    if (token !== liveToken) return;
    if (session?.started_at) return;
    await endLiveWorkout();
  } catch {
    // Keep the card when we can't tell whether a workout is still active.
  }
}

/** True once, after the Current set shortcut asked the app to open the sheet. */
export async function consumeQuickWorkoutOpen(): Promise<{
  open: boolean;
  exerciseIndex: number;
} | null> {
  if (!onIos()) return null;
  try {
    return await LiveWorkout.consumeQuickOpen();
  } catch {
    return null;
  }
}

export async function currentLiveDraft(): Promise<{
  exerciseIndex: number;
  setId: string;
  reps: number;
  weightKg: number;
} | null> {
  const snap = await currentLiveSnapshot();
  if (!snap?.setId) return null;
  return snap;
}

async function currentLiveSnapshot(): Promise<LiveSnapshot | null> {
  if (!onIos()) return null;
  try {
    return await LiveWorkout.currentDraft();
  } catch {
    return null;
  }
}

export async function flushLiveWorkoutLogs(): Promise<void> {
  if (!onIos()) return;
  await LiveWorkout.flush().catch(() => undefined);
}

/** Pulls Lock Screen logs into the open workout, including any the server hasn't stored yet. */
export async function catchUpLiveSession(sessionId: string): Promise<{
  exercises: WorkoutSessionExercise[];
  exerciseIndex: number;
  draft: { setId: string; reps: number; weightKg: number } | null;
} | null> {
  if (!onIos()) return null;
  void flushLiveWorkoutLogs();
  const details = await getWorkoutSession(sessionId);
  const snap = await currentLiveSnapshot();
  noteLiveRevision(snap?.revision ?? 0);
  if (!details?.exercises) return null;
  const exercises = mergeLiveBoard(
    details.exercises,
    parseBoard(snap?.boardJson),
    pendingSets(snap?.pendingJson)
  );
  const preferred = snap?.exerciseIndex ?? 0;
  const exerciseIndex = firstOpenExerciseIndex(exercises, preferred);
  const open = exercises[exerciseIndex]?.sets?.find((set) => !set.completed);
  const draft =
    snap?.setId && open && snap.setId === open.id
      ? { setId: snap.setId, reps: snap.reps, weightKg: snap.weightKg }
      : null;
  return { exercises, exerciseIndex, draft };
}

export function subscribeAppForeground(listener: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };
  document.addEventListener("visibilitychange", onVisible);
  let removeNative: (() => void) | undefined;
  if (onIos()) {
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) listener();
      }).then((handle) => {
        removeNative = () => {
          void handle.remove();
        };
      })
    );
  }
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    removeNative?.();
  };
}

/** Debounced Lock Screen updates while a strength workout is started. */
export function useLiveWorkoutPublisher(enabled: boolean) {
  const timer = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const latest = useRef<LiveWorkoutPayload | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) resumeLivePublishing();
  }, [enabled]);

  const publish = useCallback((payload: LiveWorkoutPayload) => {
    latest.current = payload;
    if (!enabledRef.current || liveSuppressed || !liveRevisionReady) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    const token = liveToken;
    const baseRevision = liveBaseRevision;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!enabledRef.current || liveSuppressed || token !== liveToken) return;
      void syncLiveWorkout(payload, baseRevision);
    }, 40);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void currentLiveSnapshot().then((snap) => {
      if (cancelled || !enabledRef.current) return;
      const revision = snap?.revision ?? 0;
      noteLiveRevision(revision);
      if (revision === 0 && latest.current) publish(latest.current);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, publish]);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    void endLiveWorkout();
  }, [enabled]);

  return publish;
}
