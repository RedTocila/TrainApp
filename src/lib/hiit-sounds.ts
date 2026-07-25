import type { CheckoutLocale } from "@/lib/checkout-i18n";
import type { HiitPhaseType } from "@/lib/hiit";

const MUTE_KEY = "hiit-sounds-muted";

let audioCtx: AudioContext | null = null;
let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

type CueKey = "start" | "prepare" | "go" | "rest" | "break" | "done";

const CUES: Record<CheckoutLocale, Record<CueKey, string>> = {
  en: {
    start: "Start",
    prepare: "Get ready",
    go: "Go",
    rest: "Rest",
    break: "Break",
    done: "Done",
  },
  al: {
    start: "Fillo",
    prepare: "Përgatitu",
    go: "Shko",
    rest: "Pushim",
    break: "Pushim",
    done: "Mbaroi",
  },
};

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

function refreshVoices(locale: CheckoutLocale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesReady = true;
  preferredVoice = pickMaleVoice(voices, locale);
}

/** Prefer Alex / other male voices; fall back to lower-pitch English for Albanian. */
function pickMaleVoice(
  voices: SpeechSynthesisVoice[],
  locale: CheckoutLocale
): SpeechSynthesisVoice | null {
  const maleName =
    /\b(alex|daniel|david|james|mark|fred|tom|thomas|arthur|aaron|gordon|bruce|ralph|male|männlich)\b/i;
  const femaleName =
    /\b(samantha|victoria|karen|moira|tessa|fiona|karen|susan|zira|female|frau|woman)\b/i;

  const byLang = (prefix: string) =>
    voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));

  const alex = voices.find((v) => /^alex\b/i.test(v.name.trim()));
  if (locale === "en" && alex) return alex;

  if (locale === "al") {
    const sq = byLang("sq");
    const sqMale = sq.find((v) => maleName.test(v.name) && !femaleName.test(v.name));
    if (sqMale) return sqMale;
    if (sq[0] && !femaleName.test(sq[0].name)) return sq[0];
    // No Albanian voice on most devices — use Alex (or another male EN) for SQ text.
    if (alex) return alex;
    const enMale = byLang("en").find(
      (v) => maleName.test(v.name) && !femaleName.test(v.name)
    );
    if (enMale) return enMale;
  }

  const en = byLang("en");
  if (alex) return alex;
  const enMale = en.find((v) => maleName.test(v.name) && !femaleName.test(v.name));
  if (enMale) return enMale;

  // Last resort: any non-female English voice, else first voice.
  const nonFemale = en.find((v) => !femaleName.test(v.name));
  return nonFemale ?? en[0] ?? voices[0] ?? null;
}

function speak(text: string, locale: CheckoutLocale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (getHiitSoundsMuted()) return;

  refreshVoices(locale);
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale === "al" ? "sq-AL" : "en-US";
  utter.rate = 1.05;
  // Slightly lower pitch helps when the OS only offers a female voice.
  utter.pitch = 0.85;
  utter.volume = 1;
  if (preferredVoice) utter.voice = preferredVoice;

  window.speechSynthesis.speak(utter);
}

function speakCue(key: CueKey, locale: CheckoutLocale) {
  speak(CUES[locale][key], locale);
}

/** Call from a user gesture (Start / Resume) so browsers allow playback. */
export function unlockHiitAudio(locale: CheckoutLocale = "en") {
  const ctx = getCtx();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  refreshVoices(locale);
  if (!voicesReady) {
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => refreshVoices(locale),
      { once: true }
    );
  }
  // Warm the engine on user gesture (some browsers gate TTS until then).
  window.speechSynthesis.cancel();
  const warm = new SpeechSynthesisUtterance("");
  warm.volume = 0;
  window.speechSynthesis.speak(warm);
  window.speechSynthesis.cancel();
}

export function getHiitSoundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setHiitSoundsMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (muted && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
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
export function playHiitTick(secondsLeft: number, _locale: CheckoutLocale) {
  const freq = secondsLeft <= 1 ? 980 : secondsLeft <= 2 ? 820 : 660;
  const gain = secondsLeft <= 1 ? 0.22 : 0.14;
  beep(freq, secondsLeft <= 1 ? 90 : 55, { type: "square", gain });
}

export function playHiitStart(locale: CheckoutLocale) {
  beep(440, 80, { type: "triangle", gain: 0.16 });
  window.setTimeout(() => beep(660, 110, { type: "triangle", gain: 0.18 }), 90);
  speakCue("start", locale);
}

export function playHiitPhaseChange(type: HiitPhaseType, locale: CheckoutLocale) {
  switch (type) {
    case "work":
      beep(520, 70, { type: "square", gain: 0.16 });
      window.setTimeout(() => beep(780, 140, { type: "square", gain: 0.2 }), 80);
      speakCue("go", locale);
      break;
    case "rest":
      beep(420, 120, { type: "sine", gain: 0.14 });
      speakCue("rest", locale);
      break;
    case "round_rest":
    case "cycle_rest":
      beep(360, 100, { type: "sine", gain: 0.13 });
      window.setTimeout(() => beep(300, 140, { type: "sine", gain: 0.12 }), 100);
      speakCue("break", locale);
      break;
    case "prepare":
      beep(500, 100, { type: "triangle", gain: 0.15 });
      speakCue("prepare", locale);
      break;
    case "done":
      playHiitComplete(locale);
      break;
    default:
      beep(500, 80, { type: "sine", gain: 0.12 });
  }
}

export function playHiitComplete(locale: CheckoutLocale) {
  beep(523, 100, { type: "triangle", gain: 0.16 });
  window.setTimeout(() => beep(659, 100, { type: "triangle", gain: 0.16 }), 110);
  window.setTimeout(() => beep(784, 180, { type: "triangle", gain: 0.18 }), 220);
  speakCue("done", locale);
}
