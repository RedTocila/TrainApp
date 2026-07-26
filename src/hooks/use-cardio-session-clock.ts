"use client";

import { useEffect, useState } from "react";
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
    return subscribeCardioTimerChange(refresh);
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
