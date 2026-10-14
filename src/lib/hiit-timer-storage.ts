import type { HiitConfig } from "@/lib/hiit";

export type HiitTimerStatus = "idle" | "running" | "paused" | "completed";

export type HiitTimerState = {
  sessionId: string;
  status: HiitTimerStatus;
  phaseIndex: number;
  /** Remaining ms in the current phase when paused / between ticks. */
  phaseRemainingMs: number;
  /** Wall-clock ms when the current running segment started. */
  segmentStartedAt: number | null;
  /** Elapsed workout ms excluding current running segment. */
  accumulatedElapsedMs: number;
  configHash: string;
};

const STORAGE_PREFIX = "hiit-timer-";

function storageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function hiitConfigHash(config: HiitConfig): string {
  return JSON.stringify({
    prepare: config.prepare_seconds,
    rounds: config.rounds,
    roundRest: config.round_rest_seconds,
    cycles: config.cycles,
    cycleRest: config.cycle_rest_seconds,
    exercises: config.exercises.map((e) => [
      e.name,
      e.work_seconds,
      e.rest_seconds,
    ]),
  });
}

export function getHiitTimerState(sessionId: string): HiitTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(sessionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HiitTimerState;
    if (
      !parsed ||
      parsed.sessionId !== sessionId ||
      typeof parsed.phaseIndex !== "number" ||
      typeof parsed.phaseRemainingMs !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setHiitTimerState(state: HiitTimerState) {
  localStorage.setItem(storageKey(state.sessionId), JSON.stringify(state));
}

export function clearHiitTimerState(sessionId: string) {
  localStorage.removeItem(storageKey(sessionId));
}

export function getPhaseRemainingMs(
  state: HiitTimerState | null,
  nowMs = Date.now()
): number {
  if (!state) return 0;
  if (state.status !== "running" || state.segmentStartedAt == null) {
    return Math.max(0, state.phaseRemainingMs);
  }
  const elapsed = Math.max(0, nowMs - state.segmentStartedAt);
  return Math.max(0, state.phaseRemainingMs - elapsed);
}

export function getHiitElapsedMs(
  state: HiitTimerState | null,
  nowMs = Date.now()
): number {
  if (!state) return 0;
  const runningExtra =
    state.status === "running" && state.segmentStartedAt != null
      ? Math.max(0, nowMs - state.segmentStartedAt)
      : 0;
  // While running, phase countdown falling is part of elapsed; track wall elapsed via segments.
  void runningExtra;
  if (state.status === "running" && state.segmentStartedAt != null) {
    return Math.max(
      0,
      state.accumulatedElapsedMs + (nowMs - state.segmentStartedAt)
    );
  }
  return Math.max(0, state.accumulatedElapsedMs);
}

export function startHiitTimer(
  sessionId: string,
  firstPhaseMs: number,
  configHash: string
): HiitTimerState {
  const next: HiitTimerState = {
    sessionId,
    status: "running",
    phaseIndex: 0,
    phaseRemainingMs: firstPhaseMs,
    segmentStartedAt: Date.now(),
    accumulatedElapsedMs: 0,
    configHash,
  };
  setHiitTimerState(next);
  return next;
}

export function pauseHiitTimer(sessionId: string): HiitTimerState | null {
  const existing = getHiitTimerState(sessionId);
  if (!existing || existing.status !== "running") return existing;
  const remaining = getPhaseRemainingMs(existing);
  const elapsed = getHiitElapsedMs(existing);
  const next: HiitTimerState = {
    ...existing,
    status: "paused",
    phaseRemainingMs: remaining,
    segmentStartedAt: null,
    accumulatedElapsedMs: elapsed,
  };
  setHiitTimerState(next);
  return next;
}

export function resumeHiitTimer(sessionId: string): HiitTimerState | null {
  const existing = getHiitTimerState(sessionId);
  if (!existing || existing.status !== "paused") return existing;
  const next: HiitTimerState = {
    ...existing,
    status: "running",
    segmentStartedAt: Date.now(),
  };
  setHiitTimerState(next);
  return next;
}

export function advanceHiitPhase(
  sessionId: string,
  nextPhaseIndex: number,
  nextPhaseMs: number,
  completed = false
): HiitTimerState | null {
  const existing = getHiitTimerState(sessionId);
  if (!existing) return null;
  const elapsed = getHiitElapsedMs(existing);
  const next: HiitTimerState = {
    ...existing,
    status: completed ? "completed" : "running",
    phaseIndex: nextPhaseIndex,
    phaseRemainingMs: nextPhaseMs,
    segmentStartedAt: completed ? null : Date.now(),
    accumulatedElapsedMs: elapsed,
  };
  setHiitTimerState(next);
  return next;
}

export function resetHiitTimer(sessionId: string): void {
  clearHiitTimerState(sessionId);
}

/**
 * Walks a running timer forward by wall-clock time so backgrounding
 * does not freeze the interval on the phase that expired.
 */
export function catchUpHiitTimer(
  sessionId: string,
  phaseDurationsMs: number[]
): HiitTimerState | null {
  const existing = getHiitTimerState(sessionId);
  if (
    !existing ||
    existing.status !== "running" ||
    existing.segmentStartedAt == null
  ) {
    return existing;
  }

  const now = Date.now();
  let index = existing.phaseIndex;
  let phaseMs = Math.max(0, existing.phaseRemainingMs);
  let cursor = existing.segmentStartedAt;
  const origin = existing.segmentStartedAt;
  let steps = 0;
  const limit = Math.max(phaseDurationsMs.length, 1) + 1;

  while (steps < limit && cursor + phaseMs <= now) {
    cursor += phaseMs;
    index += 1;
    steps += 1;
    if (index >= phaseDurationsMs.length) {
      const done: HiitTimerState = {
        ...existing,
        status: "completed",
        phaseIndex: Math.max(0, phaseDurationsMs.length - 1),
        phaseRemainingMs: 0,
        segmentStartedAt: null,
        accumulatedElapsedMs:
          existing.accumulatedElapsedMs + Math.max(0, now - origin),
      };
      setHiitTimerState(done);
      return done;
    }
    phaseMs = Math.max(0, phaseDurationsMs[index] ?? 0);
  }

  if (steps === 0) return existing;

  const consumed = Math.max(0, now - cursor);
  const next: HiitTimerState = {
    ...existing,
    status: "running",
    phaseIndex: index,
    phaseRemainingMs: phaseMs,
    segmentStartedAt: now - consumed,
    accumulatedElapsedMs:
      existing.accumulatedElapsedMs + Math.max(0, cursor - origin),
  };
  setHiitTimerState(next);
  return next;
}
