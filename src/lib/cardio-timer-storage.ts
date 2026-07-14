export type CardioTimerStatus = "idle" | "running" | "paused";

export type CardioTimerState = {
  dateKey: string;
  status: CardioTimerStatus;
  /** Elapsed ms accumulated while paused / before current segment. */
  accumulatedMs: number;
  /** Wall-clock ms when the current running segment started. */
  segmentStartedAt: number | null;
};

const STORAGE_PREFIX = "cardio-timer-";

function storageKey(dateKey: string) {
  return `${STORAGE_PREFIX}${dateKey}`;
}

export function getCardioTimerState(dateKey: string): CardioTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(dateKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CardioTimerState;
    if (
      !parsed ||
      parsed.dateKey !== dateKey ||
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

export function setCardioTimerState(state: CardioTimerState) {
  localStorage.setItem(storageKey(state.dateKey), JSON.stringify(state));
}

export function clearCardioTimerState(dateKey: string) {
  localStorage.removeItem(storageKey(dateKey));
}

export function isCardioTimerActive(dateKey: string): boolean {
  const state = getCardioTimerState(dateKey);
  return state?.status === "running" || state?.status === "paused";
}

export function getCardioElapsedMs(
  state: CardioTimerState | null,
  nowMs = Date.now()
): number {
  if (!state) return 0;
  const runningExtra =
    state.status === "running" && state.segmentStartedAt != null
      ? Math.max(0, nowMs - state.segmentStartedAt)
      : 0;
  return Math.max(0, state.accumulatedMs + runningExtra);
}

export function startCardioTimer(dateKey: string): CardioTimerState {
  const existing = getCardioTimerState(dateKey);
  if (existing?.status === "running") return existing;

  const next: CardioTimerState = {
    dateKey,
    status: "running",
    accumulatedMs: existing?.accumulatedMs ?? 0,
    segmentStartedAt: Date.now(),
  };
  setCardioTimerState(next);
  return next;
}

export function pauseCardioTimer(dateKey: string): CardioTimerState | null {
  const existing = getCardioTimerState(dateKey);
  if (!existing || existing.status !== "running") return existing;

  const next: CardioTimerState = {
    dateKey,
    status: "paused",
    accumulatedMs: getCardioElapsedMs(existing),
    segmentStartedAt: null,
  };
  setCardioTimerState(next);
  return next;
}

export function resumeCardioTimer(dateKey: string): CardioTimerState | null {
  const existing = getCardioTimerState(dateKey);
  if (!existing || existing.status !== "paused") return existing;

  const next: CardioTimerState = {
    dateKey,
    status: "running",
    accumulatedMs: existing.accumulatedMs,
    segmentStartedAt: Date.now(),
  };
  setCardioTimerState(next);
  return next;
}
