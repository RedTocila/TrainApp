"use client";

import {
  openWorkoutSession,
  type OpenedWorkout,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";

export const WORKOUT_SESSION_OPEN_PATH = "/dashboard/workout/session/open";

const STORAGE_KEY = "rutina:staged-workout-open";

export type StagedWorkoutOpen = {
  workout: TodaysWorkoutInfo;
  gender?: string | null;
  continuesToMain?: boolean;
  sessionId?: string | null;
};

let staged: StagedWorkoutOpen | null = null;
let rememberedGender: string | null = null;
let openLockUntil = 0;
let flight: Promise<OpenedWorkout> | null = null;
let flightKey = "";

export function pendingWorkoutSessionId(dayId: string) {
  return `pending-${dayId}`;
}

export function isPendingWorkoutSessionId(id: string | null | undefined) {
  return Boolean(id?.startsWith("pending-"));
}

export function rememberWorkoutGender(gender?: string | null) {
  if (gender) rememberedGender = gender;
}

export function stageWorkoutOpen(
  workout: TodaysWorkoutInfo,
  options?: { gender?: string | null; continuesToMain?: boolean }
): boolean {
  const now = Date.now();
  if (now < openLockUntil) return false;
  openLockUntil = now + 700;
  flight = null;
  flightKey = "";
  staged = {
    workout,
    gender: options?.gender ?? rememberedGender,
    continuesToMain: options?.continuesToMain ?? false,
    sessionId: null,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(staged));
  } catch {
    // The in-memory copy is enough for this navigation.
  }
  return true;
}

export function readStagedWorkoutOpen(): StagedWorkoutOpen | null {
  if (staged) return staged;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StagedWorkoutOpen;
    if (!parsed?.workout?.planId || !parsed.workout.dayId) return null;
    staged = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function rememberOpenedSession(sessionId: string) {
  if (!staged) return;
  staged = { ...staged, sessionId };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(staged));
  } catch {
    // Refresh can still use the module copy in this tab.
  }
}

export function openWorkoutSessionCached(
  snapshot: StagedWorkoutOpen
): Promise<OpenedWorkout> {
  const workout = snapshot.workout;
  const key = `${workout.planId}:${workout.dayId}:${workout.scheduledWorkoutId ?? ""}:${workout.scheduledDate ?? ""}`;
  if (flight && flightKey === key) return flight;
  flightKey = key;
  const promise = openWorkoutSession({
    planId: workout.planId,
    dayId: workout.dayId,
    scheduledDate: workout.scheduledDate,
    scheduledWorkoutId: workout.scheduledWorkoutId ?? null,
  });
  flight = promise;
  void promise.then((result) => {
    if (flight === promise && result.error) {
      flight = null;
      flightKey = "";
    }
  });
  return promise;
}
