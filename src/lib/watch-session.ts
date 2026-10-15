import { Capacitor, registerPlugin } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

export type WorkoutMirror = {
  origin: string;
  seq: number;
  status: string;
  mode: string;
  action: string;
  sessionId: string;
  exerciseIndex: number;
  setId: string;
  reps: number;
  weightKg: number;
  hiitIndex: number;
  hiitRunning: boolean;
  hiitLeft: number;
  hiitEndsAt: number;
  receivedAt: number;
};

type WatchSessionPlugin = {
  sync(options: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    apiBase: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }): Promise<void>;
  clear(): Promise<void>;
  pushMirror(options: {
    status: string;
    mode?: string;
    action: string;
    sessionId?: string;
    exerciseIndex?: number;
    setId?: string;
    reps?: number;
    weightKg?: number;
    hiitIndex?: number;
    hiitRunning?: boolean;
    hiitLeft?: number;
    hiitEndsAt?: number;
  }): Promise<void>;
  pushCardio(options: {
    status: string;
    action: string;
    cardioId: string;
    elapsedSeconds: number;
    completed: boolean;
  }): Promise<void>;
  addListener(
    event: "workoutMirror",
    handler: (payload: Record<string, unknown>) => void
  ): Promise<{ remove: () => Promise<void> }>;
};

const WatchSession = registerPlugin<WatchSessionPlugin>("WatchSession");

/** Copy the signed-in Supabase session to the Apple Watch. iOS shell only. */
export async function syncWatchSession(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.refresh_token) {
    await WatchSession.clear().catch(() => undefined);
    return;
  }

  await WatchSession.sync({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
    apiBase: window.location.origin,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  }).catch(() => undefined);
}

let latestMirror: WorkoutMirror | null = null;
let mirrorListening = false;
let suppressMirrorUntil = 0;
const mirrorListeners = new Set<(event: WorkoutMirror) => void>();

function onIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMirror(raw: Record<string, unknown>): WorkoutMirror {
  return {
    origin: String(raw.origin ?? ""),
    seq: asNumber(raw.seq),
    status: String(raw.status ?? ""),
    mode: String(raw.mode ?? "strength"),
    action: String(raw.action ?? "move"),
    sessionId: String(raw.sessionId ?? ""),
    exerciseIndex: asNumber(raw.exerciseIndex),
    setId: String(raw.setId ?? ""),
    reps: asNumber(raw.reps, 8),
    weightKg: asNumber(raw.weightKg, 20),
    hiitIndex: asNumber(raw.hiitIndex),
    hiitRunning:
      raw.hiitRunning === true || raw.hiitRunning === 1 || raw.hiitRunning === "true",
    hiitLeft: asNumber(raw.hiitLeft),
    hiitEndsAt: asNumber(raw.hiitEndsAt),
    receivedAt: Date.now(),
  };
}

export function latestWorkoutMirror(): WorkoutMirror | null {
  return latestMirror;
}

/** Ignore the echo of a mirror we just applied. */
export function suppressWorkoutMirror(ms = 500) {
  suppressMirrorUntil = Date.now() + ms;
}

export function subscribeWorkoutMirror(listener: (event: WorkoutMirror) => void) {
  mirrorListeners.add(listener);
  void ensureMirrorListener();
  return () => {
    mirrorListeners.delete(listener);
  };
}

async function ensureMirrorListener() {
  if (mirrorListening || !onIos()) return;
  mirrorListening = true;
  await WatchSession.addListener("workoutMirror", (raw) => {
    const event = normalizeMirror(raw);
    if (event.origin === "phone") return;
    latestMirror = event;
    mirrorListeners.forEach((listener) => listener(event));
  }).catch(() => {
    mirrorListening = false;
  });
}

export async function pushWorkoutMirror(input: {
  status: string;
  action: string;
  mode?: string;
  sessionId?: string | null;
  exerciseIndex?: number;
  setId?: string | null;
  reps?: number;
  weightKg?: number;
  hiitIndex?: number;
  hiitRunning?: boolean;
  hiitLeft?: number;
  hiitEndsAt?: number;
}): Promise<void> {
  if (!onIos() || Date.now() < suppressMirrorUntil) return;
  await WatchSession.pushMirror({
    status: input.status,
    action: input.action,
    mode: input.mode ?? "strength",
    sessionId: input.sessionId ?? "",
    exerciseIndex: input.exerciseIndex ?? 0,
    setId: input.setId ?? "",
    reps: input.reps ?? 0,
    weightKg: input.weightKg ?? 0,
    hiitIndex: input.hiitIndex ?? 0,
    hiitRunning: input.hiitRunning ?? false,
    hiitLeft: input.hiitLeft ?? 0,
    hiitEndsAt: input.hiitEndsAt ?? 0,
  }).catch(() => undefined);
}

/** Tell the open Apple Watch that cardio started, paused, resumed, or stopped. */
export async function pushCardioMirror(input: {
  status: "idle" | "running" | "paused" | "completed";
  action: string;
  cardioId: string;
  elapsedSeconds: number;
  completed?: boolean;
}): Promise<void> {
  if (!onIos() || !input.cardioId) return;
  await WatchSession.pushCardio({
    status: input.status,
    action: input.action,
    cardioId: input.cardioId,
    elapsedSeconds: Math.max(0, Math.round(input.elapsedSeconds)),
    completed: input.completed ?? input.status === "completed",
  }).catch(() => undefined);
}
