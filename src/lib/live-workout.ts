"use client";

import { useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

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
};

type LiveWorkoutPlugin = {
  sync(options: LiveWorkoutPayload): Promise<void>;
  end(): Promise<void>;
  consumeQuickOpen(): Promise<{ open: boolean; exerciseIndex: number }>;
  currentDraft(): Promise<{
    exerciseIndex: number;
    setId: string;
    reps: number;
    weightKg: number;
  }>;
};

const LiveWorkout = registerPlugin<LiveWorkoutPlugin>("LiveWorkout");

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

/** Push the current set to the Lock Screen card. No-op off the iPhone app. */
export async function syncLiveWorkout(payload: LiveWorkoutPayload): Promise<void> {
  if (!onIos()) return;
  await LiveWorkout.sync({
    ...payload,
    gifUrl: absoluteGif(payload.gifUrl),
    reps: Math.min(40, Math.max(1, Math.round(payload.reps) || 1)),
    weightKg: Math.min(200, Math.max(0, Number(payload.weightKg) || 0)),
  }).catch(() => undefined);
}

export async function endLiveWorkout(): Promise<void> {
  if (!onIos()) return;
  await LiveWorkout.end().catch(() => undefined);
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
  if (!onIos()) return null;
  try {
    const draft = await LiveWorkout.currentDraft();
    if (!draft?.setId) return null;
    return draft;
  } catch {
    return null;
  }
}

/** Debounced Lock Screen updates while a strength workout is started. */
export function useLiveWorkoutPublisher(enabled: boolean) {
  const timer = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const publish = useCallback((payload: LiveWorkoutPayload) => {
    if (!enabledRef.current) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void syncLiveWorkout(payload);
    }, 200);
  }, []);

  useEffect(() => {
    if (!enabled) void endLiveWorkout();
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [enabled]);

  return publish;
}
