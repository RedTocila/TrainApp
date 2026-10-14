"use client";

import { useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { pushWorkoutMirror } from "@/lib/watch-session";

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
  prepareBackTap(options: { title: string; message: string; dismiss: string }): Promise<void>;
};

const LiveWorkout = registerPlugin<LiveWorkoutPlugin>("LiveWorkout");

let liveToken = 0;
let liveSuppressed = false;

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

/** Push the current set to the Lock Screen card. No-op off the iPhone app. */
export async function syncLiveWorkout(payload: LiveWorkoutPayload): Promise<void> {
  if (!onIos() || liveSuppressed) return;
  await LiveWorkout.sync({
    ...payload,
    gifUrl: absoluteGif(payload.gifUrl),
    reps: Math.min(40, Math.max(1, Math.round(payload.reps) || 1)),
    weightKg: Math.min(200, Math.max(0, Number(payload.weightKg) || 0)),
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
  if (!onIos()) return null;
  try {
    const draft = await LiveWorkout.currentDraft();
    if (!draft?.setId) return null;
    return draft;
  } catch {
    return null;
  }
}

/** Opens the system card that saves Current set into Shortcuts, so Back Tap can list it. */
export async function prepareBackTapShortcut(copy: {
  title: string;
  message: string;
  dismiss: string;
}): Promise<void> {
  if (!onIos()) return;
  await LiveWorkout.prepareBackTap(copy).catch(() => undefined);
}

/** Debounced Lock Screen updates while a strength workout is started. */
export function useLiveWorkoutPublisher(enabled: boolean) {
  const timer = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const wasEnabled = useRef(false);
  enabledRef.current = enabled;
  if (enabled && !wasEnabled.current) resumeLivePublishing();
  wasEnabled.current = enabled;

  const publish = useCallback((payload: LiveWorkoutPayload) => {
    if (!enabledRef.current || liveSuppressed) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    const token = liveToken;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!enabledRef.current || liveSuppressed || token !== liveToken) return;
      void syncLiveWorkout(payload);
    }, 200);
  }, []);

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
