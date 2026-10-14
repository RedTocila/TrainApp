"use client";

import { useEffect, useState } from "react";
import { pullCardioTimerIntoLocal } from "@/lib/cardio-timer-sync";
import {
  getCardioElapsedMs,
  getCardioTimerState,
  subscribeCardioTimerChange,
  type CardioTimerState,
} from "@/lib/cardio-timer-storage";

/** Live / paused cardio session clock for dashboard surfaces. */
export function useCardioSessionClock(
  dateKey: string,
  cardioId: string | null,
  syncVersion = 0
) {
  const [timer, setTimer] = useState<CardioTimerState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      setTimer(getCardioTimerState(dateKey, cardioId));
      setNowMs(Date.now());
    };
    refresh();
    const unsubscribe = subscribeCardioTimerChange(refresh);
    if (!cardioId) return unsubscribe;

    let cancelled = false;
    const pull = () => {
      void pullCardioTimerIntoLocal(dateKey, cardioId).then(() => {
        if (!cancelled) refresh();
      });
    };
    pull();
    const poll = window.setInterval(pull, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [dateKey, cardioId, syncVersion]);

  useEffect(() => {
    if (timer?.status !== "running") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer?.status, timer?.segmentStartedAt, timer?.accumulatedMs]);

  const active =
    timer?.status === "running" || timer?.status === "paused";
  const running = timer?.status === "running";
  const elapsedSeconds = Math.floor(getCardioElapsedMs(timer, nowMs) / 1000);

  return { active, running, paused: timer?.status === "paused", elapsedSeconds };
}
