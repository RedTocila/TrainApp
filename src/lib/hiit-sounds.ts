import type { HiitPhaseType } from "@/lib/hiit";

const MUTE_KEY = "hiit-sounds-muted";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Call from a user gesture (Start / Resume) so browsers allow playback. */
export function unlockHiitAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

export function getHiitSoundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setHiitSoundsMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function beep(
  frequency: number,
  durationMs: number,
  {
    type = "sine",
    gain = 0.18,
    ramp = true,
  }: {
    type?: OscillatorType;
    gain?: number;
    ramp?: boolean;
  } = {}
) {
  if (getHiitSoundsMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  g.gain.setValueAtTime(ramp ? 0.0001 : gain, now);
  if (ramp) {
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  } else {
    g.gain.setValueAtTime(gain, now);
    g.gain.setValueAtTime(0.0001, now + durationMs / 1000);
  }
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

/** Short tick for each of the last 5 seconds of a phase. */
export function playHiitTick(secondsLeft: number) {
  // Higher pitch as we approach zero.
  const freq = secondsLeft <= 1 ? 980 : secondsLeft <= 2 ? 820 : 660;
  const gain = secondsLeft <= 1 ? 0.22 : 0.14;
  beep(freq, secondsLeft <= 1 ? 90 : 55, { type: "square", gain });
}

export function playHiitStart() {
  beep(440, 80, { type: "triangle", gain: 0.16 });
  window.setTimeout(() => beep(660, 110, { type: "triangle", gain: 0.18 }), 90);
}

export function playHiitPhaseChange(type: HiitPhaseType) {
  switch (type) {
    case "work":
      beep(520, 70, { type: "square", gain: 0.16 });
      window.setTimeout(() => beep(780, 140, { type: "square", gain: 0.2 }), 80);
      break;
    case "rest":
      beep(420, 120, { type: "sine", gain: 0.14 });
      break;
    case "round_rest":
    case "cycle_rest":
      beep(360, 100, { type: "sine", gain: 0.13 });
      window.setTimeout(() => beep(300, 140, { type: "sine", gain: 0.12 }), 100);
      break;
    case "prepare":
      beep(500, 100, { type: "triangle", gain: 0.15 });
      break;
    case "done":
      playHiitComplete();
      break;
    default:
      beep(500, 80, { type: "sine", gain: 0.12 });
  }
}

export function playHiitComplete() {
  beep(523, 100, { type: "triangle", gain: 0.16 });
  window.setTimeout(() => beep(659, 100, { type: "triangle", gain: 0.16 }), 110);
  window.setTimeout(() => beep(784, 180, { type: "triangle", gain: 0.18 }), 220);
}
