"use client";

import {
  getRemoteCardioTimer,
  saveRemoteCardioTimer,
} from "@/lib/actions/cardio-timer";
import {
  clearCardioTimerState,
  getCardioTimerState,
  setCardioTimerState,
  type CardioTimerState,
} from "@/lib/cardio-timer-storage";

function sameTimer(local: CardioTimerState | null, next: CardioTimerState) {
  if (!local) return false;
  return (
    local.status === next.status &&
    local.accumulatedMs === next.accumulatedMs &&
    local.segmentStartedAt === next.segmentStartedAt
  );
}

export function pushLocalCardioTimer(state: CardioTimerState) {
  if (!state.cardioId) return;
  void saveRemoteCardioTimer({
    date: state.dateKey,
    cardioId: state.cardioId,
    status: state.status === "idle" ? "idle" : state.status,
    accumulatedMs: state.accumulatedMs,
    segmentStartedAt: state.segmentStartedAt,
  }).catch(() => undefined);
}

export function clearRemoteCardioTimer(dateKey: string, cardioId: string | null | undefined) {
  if (!cardioId) return;
  void saveRemoteCardioTimer({
    date: dateKey,
    cardioId,
    status: "idle",
    accumulatedMs: 0,
    segmentStartedAt: null,
  }).catch(() => undefined);
}

/** Pull the shared clock. A brand-new local start is published instead of wiped. */
export async function pullCardioTimerIntoLocal(dateKey: string, cardioId: string) {
  const remote = await getRemoteCardioTimer(dateKey, cardioId);
  if (!remote || "error" in remote) return;

  const local = getCardioTimerState(dateKey, cardioId);
  const timer = remote.timer;

  if (timer.status === "idle") {
    if (local && (local.status === "running" || local.status === "paused")) {
      const remoteAt = Date.parse(timer.updatedAt);
      const localAt = local.segmentStartedAt ?? 0;
      if (Number.isFinite(remoteAt) && remoteAt > localAt) {
        clearCardioTimerState(dateKey, cardioId);
        return;
      }
      const age = Date.now() - localAt;
      if (local.status === "running" && age < 8000 && !(remoteAt > 0)) return;
      pushLocalCardioTimer(local);
      return;
    }
    if (local) clearCardioTimerState(dateKey, cardioId);
    return;
  }

  const next: CardioTimerState = {
    dateKey,
    cardioId,
    status: timer.status,
    accumulatedMs: timer.accumulatedMs,
    segmentStartedAt: timer.segmentStartedAt
      ? Date.parse(timer.segmentStartedAt)
      : null,
  };

  if (
    local?.status === "running" &&
    local.segmentStartedAt &&
    next.segmentStartedAt &&
    local.segmentStartedAt > next.segmentStartedAt + 2000
  ) {
    pushLocalCardioTimer(local);
    return;
  }

  if (sameTimer(local, next)) return;
  setCardioTimerState(next);
}
