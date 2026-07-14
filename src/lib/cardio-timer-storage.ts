export type CardioTimerStatus = "idle" | "running" | "paused";

export type CardioTimerState = {
  dateKey: string;
  /** Optional for legacy timers that were keyed by date only. */
  cardioId?: string | null;
  status: CardioTimerStatus;
  /** Elapsed ms accumulated while paused / before current segment. */
  accumulatedMs: number;
  /** Wall-clock ms when the current running segment started. */
  segmentStartedAt: number | null;
};

const STORAGE_PREFIX = "cardio-timer-";

function storageKey(dateKey: string, cardioId?: string | null) {
  if (cardioId) return `${STORAGE_PREFIX}${dateKey}-${cardioId}`;
  return `${STORAGE_PREFIX}${dateKey}`;
}

function readRaw(key: string): CardioTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CardioTimerState;
    if (
      !parsed ||
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

export function getCardioTimerState(
  dateKey: string,
  cardioId?: string | null
): CardioTimerState | null {
  if (cardioId) {
    const keyed = readRaw(storageKey(dateKey, cardioId));
    if (keyed && (!keyed.dateKey || keyed.dateKey === dateKey)) {
      return { ...keyed, dateKey, cardioId };
    }
  }

  // Legacy date-only key — only reuse when no cardioId was stored, or it matches.
  const legacy = readRaw(storageKey(dateKey));
  if (!legacy) return null;
  if (legacy.dateKey && legacy.dateKey !== dateKey) return null;
  if (cardioId && legacy.cardioId && legacy.cardioId !== cardioId) return null;
  if (cardioId && !legacy.cardioId) {
    return { ...legacy, dateKey, cardioId };
  }
  if (!cardioId) {
    return { ...legacy, dateKey };
  }
  return null;
}

export function setCardioTimerState(state: CardioTimerState) {
  const key = storageKey(state.dateKey, state.cardioId);
  localStorage.setItem(key, JSON.stringify(state));
  // Drop legacy date-only key once we have a cardio-scoped timer.
  if (state.cardioId) {
    localStorage.removeItem(storageKey(state.dateKey));
  }
}

export function clearCardioTimerState(
  dateKey: string,
  cardioId?: string | null
) {
  if (cardioId) {
    localStorage.removeItem(storageKey(dateKey, cardioId));
  }
  localStorage.removeItem(storageKey(dateKey));
}

export function isCardioTimerActive(
  dateKey: string,
  cardioId?: string | null
): boolean {
  const state = getCardioTimerState(dateKey, cardioId);
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

export function startCardioTimer(
  dateKey: string,
  cardioId?: string | null
): CardioTimerState {
  const existing = getCardioTimerState(dateKey, cardioId);
  if (existing?.status === "running") return existing;

  const next: CardioTimerState = {
    dateKey,
    cardioId: cardioId ?? existing?.cardioId ?? null,
    status: "running",
    accumulatedMs: existing?.accumulatedMs ?? 0,
    segmentStartedAt: Date.now(),
  };
  setCardioTimerState(next);
  return next;
}

export function pauseCardioTimer(
  dateKey: string,
  cardioId?: string | null
): CardioTimerState | null {
  const existing = getCardioTimerState(dateKey, cardioId);
  if (!existing || existing.status !== "running") return existing;

  const next: CardioTimerState = {
    dateKey,
    cardioId: cardioId ?? existing.cardioId ?? null,
    status: "paused",
    accumulatedMs: getCardioElapsedMs(existing),
    segmentStartedAt: null,
  };
  setCardioTimerState(next);
  return next;
}

export function resumeCardioTimer(
  dateKey: string,
  cardioId?: string | null
): CardioTimerState | null {
  const existing = getCardioTimerState(dateKey, cardioId);
  if (!existing || existing.status !== "paused") return existing;

  const next: CardioTimerState = {
    dateKey,
    cardioId: cardioId ?? existing.cardioId ?? null,
    status: "running",
    accumulatedMs: existing.accumulatedMs,
    segmentStartedAt: Date.now(),
  };
  setCardioTimerState(next);
  return next;
}
