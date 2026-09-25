/** Strength workout elapsed timer — persisted like cardio/HIIT, keyed by session id. */

export type WorkoutTimerStatus = "idle" | "running" | "paused";

export type WorkoutTimerState = {
  sessionId: string;
  status: WorkoutTimerStatus;
  /** Elapsed ms accumulated while paused / before current segment. */
  accumulatedMs: number;
  /** Wall-clock ms when the current running segment started. */
  segmentStartedAt: number | null;
};

const STORAGE_PREFIX = "workout-timer-v2-";

function storageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function clearLegacyKeys(sessionId: string) {
  try {
    sessionStorage.removeItem(`workout-timer-anchor-${sessionId}`);
  } catch {
    /* ignore */
  }
}

export function getWorkoutTimerState(
  sessionId: string
): WorkoutTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(sessionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkoutTimerState;
    if (
      !parsed ||
      parsed.sessionId !== sessionId ||
      (parsed.status !== "idle" &&
        parsed.status !== "running" &&
        parsed.status !== "paused") ||
      typeof parsed.accumulatedMs !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setWorkoutTimerState(state: WorkoutTimerState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(state.sessionId), JSON.stringify(state));
  clearLegacyKeys(state.sessionId);
}

export function clearWorkoutTimerState(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(sessionId));
    clearLegacyKeys(sessionId);
  } catch {
    /* ignore */
  }
}

export function getWorkoutElapsedMs(
  state: WorkoutTimerState | null,
  nowMs = Date.now()
): number {
  if (!state) return 0;
  const runningExtra =
    state.status === "running" && state.segmentStartedAt != null
      ? Math.max(0, nowMs - state.segmentStartedAt)
      : 0;
  return Math.max(0, state.accumulatedMs + runningExtra);
}

export function startWorkoutTimer(sessionId: string): WorkoutTimerState {
  const existing = getWorkoutTimerState(sessionId);
  if (existing?.status === "running") return existing;

  const next: WorkoutTimerState = {
    sessionId,
    status: "running",
    accumulatedMs: existing?.accumulatedMs ?? 0,
    segmentStartedAt: Date.now(),
  };
  setWorkoutTimerState(next);
  return next;
}

export function pauseWorkoutTimer(sessionId: string): WorkoutTimerState | null {
  const existing = getWorkoutTimerState(sessionId);
  if (!existing || existing.status !== "running") return existing;

  const next: WorkoutTimerState = {
    sessionId,
    status: "paused",
    accumulatedMs: getWorkoutElapsedMs(existing),
    segmentStartedAt: null,
  };
  setWorkoutTimerState(next);
  return next;
}

export function resumeWorkoutTimer(sessionId: string): WorkoutTimerState | null {
  const existing = getWorkoutTimerState(sessionId);
  if (!existing || existing.status !== "paused") return existing;

  const next: WorkoutTimerState = {
    sessionId,
    status: "running",
    accumulatedMs: existing.accumulatedMs,
    segmentStartedAt: Date.now(),
  };
  setWorkoutTimerState(next);
  return next;
}
