import type { HiitPhaseType } from "@/lib/hiit";

const MUTE_KEY = "hiit-sounds-muted";

type Clip = {
  url: string;
  players: HTMLAudioElement[];
  cursor: number;
};

const clips = new Map<string, Clip>();
let unlocked = false;

function muted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function getHiitSoundsMuted(): boolean {
  return muted();
}

export function setHiitSoundsMuted(next: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, next ? "1" : "0");
}

function wavUrl(frequency: number, durationMs: number): string {
  const sampleRate = 22050;
  const count = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, count * 2, true);
  for (let index = 0; index < count; index += 1) {
    const attack = Math.min(1, index / 80);
    const release = Math.min(1, (count - index) / 140);
    const sample =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.5 * attack * release;
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function clip(key: string, frequency: number, durationMs: number): Clip {
  const existing = clips.get(key);
  if (existing) return existing;
  const created: Clip = {
    url: wavUrl(frequency, durationMs),
    players: [],
    cursor: 0,
  };
  for (let index = 0; index < 2; index += 1) {
    const audio = new Audio(created.url);
    audio.preload = "auto";
    created.players.push(audio);
  }
  clips.set(key, created);
  return created;
}

function playClip(key: string, frequency: number, durationMs: number) {
  if (typeof window === "undefined" || muted()) return;
  const entry = clip(key, frequency, durationMs);
  const audio = entry.players[entry.cursor % entry.players.length]!;
  entry.cursor += 1;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // A player that has not loaded yet can ignore the seek.
  }
  void audio.play().catch(() => undefined);
}

/** Call from a user gesture (Start / Resume) so iOS allows later beeps. */
export function unlockHiitAudio() {
  if (typeof window === "undefined") return;
  unlocked = true;
  const primed = [
    clip("tick", 660, 70),
    clip("tick-2", 820, 80),
    clip("tick-last", 980, 120),
    clip("start-a", 440, 80),
    clip("start-b", 660, 110),
    clip("work-a", 520, 70),
    clip("work-b", 780, 140),
    clip("rest", 420, 120),
    clip("round-a", 360, 100),
    clip("round-b", 300, 140),
    clip("prepare", 500, 100),
    clip("phase", 500, 80),
    clip("done-a", 523, 100),
    clip("done-b", 659, 100),
    clip("done-c", 784, 180),
  ];
  for (const entry of primed) {
    for (const audio of entry.players) {
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    }
  }
}

function beep(key: string, frequency: number, durationMs: number) {
  if (!unlocked) unlocked = true;
  playClip(key, frequency, durationMs);
}

/** Short tick for each of the last 5 seconds of a phase. */
export function playHiitTick(secondsLeft: number) {
  if (secondsLeft <= 1) beep("tick-last", 980, 120);
  else if (secondsLeft <= 2) beep("tick-2", 820, 80);
  else beep("tick", 660, 70);
}

export function playHiitStart() {
  beep("start-a", 440, 80);
  window.setTimeout(() => beep("start-b", 660, 110), 90);
}

export function playHiitPhaseChange(type: HiitPhaseType) {
  switch (type) {
    case "work":
      beep("work-a", 520, 70);
      window.setTimeout(() => beep("work-b", 780, 140), 80);
      break;
    case "rest":
      beep("rest", 420, 120);
      break;
    case "round_rest":
    case "cycle_rest":
      beep("round-a", 360, 100);
      window.setTimeout(() => beep("round-b", 300, 140), 100);
      break;
    case "prepare":
      beep("prepare", 500, 100);
      break;
    case "done":
      playHiitComplete();
      break;
    default:
      beep("phase", 500, 80);
  }
}

export function playHiitComplete() {
  beep("done-a", 523, 100);
  window.setTimeout(() => beep("done-b", 659, 100), 110);
  window.setTimeout(() => beep("done-c", 784, 180), 220);
}
