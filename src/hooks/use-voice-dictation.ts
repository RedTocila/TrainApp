"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceDictationStatus =
  | "idle"
  | "listening"
  | "recording"
  | "transcribing";

const SILENCE_MS = 1100;
const MIN_RECORD_MS = 450;
const SPEECH_RMS_THRESHOLD = 0.025;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speechLang(locale: string): string {
  return locale === "al" ? "sq-AL" : "en-US";
}

function whisperLang(locale: string): string | undefined {
  return locale === "al" ? "sq" : "en";
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function joinText(base: string, addition: string): string {
  const a = base.trim();
  const b = addition.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

export function useVoiceDictation({
  locale,
  value,
  onChange,
  onError,
  onComplete,
  enabled = true,
}: {
  locale: string;
  value: string;
  onChange: (next: string) => void;
  onError: (message: string) => void;
  /** Called after silence with the final transcript (auto-send). */
  onComplete?: (text: string) => void;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<VoiceDictationStatus>("idle");
  const valueRef = useRef(value);
  const baseRef = useRef(value);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const modeRef = useRef<"speech" | "record" | null>(null);
  const stopRequestedRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef(0);
  const hadSpeechRef = useRef(false);
  const lastSoundAtRef = useRef(0);
  const revealTargetRef = useRef(value);
  const revealShownRef = useRef(value);
  const revealRafRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);

  valueRef.current = value;
  onCompleteRef.current = onComplete;
  onChangeRef.current = onChange;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopReveal = useCallback(() => {
    if (revealRafRef.current != null) {
      cancelAnimationFrame(revealRafRef.current);
      revealRafRef.current = null;
    }
  }, []);

  const flushReveal = useCallback((text: string) => {
    stopReveal();
    revealTargetRef.current = text;
    revealShownRef.current = text;
    valueRef.current = text;
    onChangeRef.current(text);
  }, [stopReveal]);

  const revealTick = useCallback(() => {
    const target = revealTargetRef.current;
    let shown = revealShownRef.current;

    if (shown === target) {
      revealRafRef.current = null;
      return;
    }

    if (target.startsWith(shown)) {
      // Ease in a few characters at a time toward the live transcript.
      const remaining = target.length - shown.length;
      const step = remaining > 24 ? 4 : remaining > 10 ? 2 : 1;
      shown = target.slice(0, shown.length + step);
    } else if (shown.startsWith(target)) {
      // Interim shortened — ease back without a hard snap.
      const step = Math.max(1, Math.ceil((shown.length - target.length) / 3));
      shown = shown.slice(0, Math.max(target.length, shown.length - step));
    } else {
      // Rewritten interim hypothesis — keep shared prefix, then catch up.
      const prefix = commonPrefixLength(shown, target);
      if (shown.length > prefix + 2) {
        shown = shown.slice(0, Math.max(prefix, shown.length - 2));
      } else {
        shown = target.slice(0, Math.min(target.length, prefix + 2));
      }
    }

    revealShownRef.current = shown;
    valueRef.current = shown;
    onChangeRef.current(shown);
    revealRafRef.current = requestAnimationFrame(revealTick);
  }, []);

  const revealToward = useCallback(
    (next: string) => {
      revealTargetRef.current = next;
      if (revealRafRef.current == null) {
        revealRafRef.current = requestAnimationFrame(revealTick);
      }
    },
    [revealTick]
  );
  const cleanupAnalyser = useCallback(() => {
    if (analyserRafRef.current != null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    cleanupAnalyser();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
  }, [cleanupAnalyser]);

  const stopSpeech = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const finishWithText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || completeFiredRef.current) return;
      completeFiredRef.current = true;
      clearSilenceTimer();
      flushReveal(trimmed);
      onCompleteRef.current?.(trimmed);
    },
    [clearSilenceTimer, flushReveal]
  );

  const scheduleSpeechAutoComplete = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (modeRef.current !== "speech") return;
      const text = (revealTargetRef.current || valueRef.current).trim();
      if (!text) return;
      stopRequestedRef.current = true;
      stopSpeech();
      setStatus("idle");
      modeRef.current = null;
      finishWithText(text);
    }, SILENCE_MS);
  }, [clearSilenceTimer, finishWithText, stopSpeech]);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      clearSilenceTimer();
      stopReveal();
      stopSpeech();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
    };
  }, [cleanupMedia, clearSilenceTimer, stopReveal, stopSpeech]);

  const transcribeBlob = useCallback(
    async (blob: Blob, autoSend: boolean) => {
      setStatus("transcribing");
      try {
        const form = new FormData();
        const type = blob.type || "audio/webm";
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        form.append("audio", blob, `voice.${ext}`);
        const lang = whisperLang(locale);
        if (lang) form.append("language", lang);

        const response = await fetch("/api/ai/transcribe", {
          method: "POST",
          body: form,
        });
        const payload = (await response.json().catch(() => null)) as
          | { text?: string; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Transcription failed");
        }
        const text = payload?.text?.trim();
        if (!text) throw new Error("Couldn't catch that — try again.");
        const next = joinText(baseRef.current, text);
        flushReveal(next);
        if (autoSend) finishWithText(next);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Transcription failed");
      } finally {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    },
    [cleanupMedia, finishWithText, flushReveal, locale, onError]
  );

  const startRecording = useCallback(async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      onError("Voice input isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      baseRef.current = valueRef.current;
      modeRef.current = "record";
      stopRequestedRef.current = false;
      completeFiredRef.current = false;
      hadSpeechRef.current = false;
      recordStartedAtRef.current = Date.now();
      lastSoundAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        onError("Couldn't record audio.");
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      };
      recorder.onstop = () => {
        cleanupAnalyser();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const shouldSend = stopRequestedRef.current && hadSpeechRef.current;
        if (!stopRequestedRef.current || blob.size < 200) {
          setStatus("idle");
          modeRef.current = null;
          cleanupMedia();
          if (stopRequestedRef.current && blob.size < 200) {
            onError("Recording was too short.");
          }
          return;
        }
        void transcribeBlob(blob, shouldSend);
      };

      // Silence detection → auto-stop → Whisper → auto-send.
      // Keep AudioContext fully muted (never play mic through speakers).
      window.setTimeout(() => {
        if (modeRef.current !== "record" || mediaStreamRef.current !== stream) {
          return;
        }
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AudioCtx({ latencyHint: "interactive" });
          audioCtxRef.current = ctx;
          const mute = ctx.createGain();
          mute.gain.value = 0;
          mute.connect(ctx.destination);
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          // Analyse only — never route mic audio to output.
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);

          const tick = () => {
            if (modeRef.current !== "record") return;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            const now = Date.now();
            if (rms >= SPEECH_RMS_THRESHOLD) {
              hadSpeechRef.current = true;
              lastSoundAtRef.current = now;
            } else if (
              hadSpeechRef.current &&
              now - recordStartedAtRef.current >= MIN_RECORD_MS &&
              now - lastSoundAtRef.current >= SILENCE_MS
            ) {
              stopRequestedRef.current = true;
              if (recorder.state !== "inactive") recorder.stop();
              return;
            }
            analyserRafRef.current = requestAnimationFrame(tick);
          };
          analyserRafRef.current = requestAnimationFrame(tick);
        } catch {
          /* silence auto-stop optional; user can tap stop */
        }
      }, 120);

      recorder.start(250);
      setStatus("recording");
    } catch {
      onError("Microphone permission is required for voice input.");
      setStatus("idle");
      modeRef.current = null;
      cleanupMedia();
    }
  }, [cleanupAnalyser, cleanupMedia, onError, transcribeBlob]);

  const startSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      void startRecording();
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang(locale);
    recognitionRef.current = recognition;
    baseRef.current = valueRef.current;
    revealTargetRef.current = valueRef.current;
    revealShownRef.current = valueRef.current;
    modeRef.current = "speech";
    stopRequestedRef.current = false;
    completeFiredRef.current = false;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += piece;
        else interimChunk += piece;
      }
      if (finalChunk.trim()) {
        baseRef.current = joinText(baseRef.current, finalChunk);
      }
      const next = joinText(baseRef.current, interimChunk);
      revealToward(next);
      if (next.trim()) {
        scheduleSpeechAutoComplete();
      }
    };

    recognition.onerror = (event) => {
      clearSilenceTimer();
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        onError("Microphone permission is required for voice input.");
        setStatus("idle");
        modeRef.current = null;
        stopSpeech();
        return;
      }
      if (
        event.error === "network" ||
        event.error === "language-not-supported"
      ) {
        stopSpeech();
        void startRecording();
        return;
      }
      if (event.error === "no-speech") {
        // Keep listening; silence timer / restart handles end.
        return;
      }
      if (event.error !== "aborted") {
        onError("Couldn't hear that — try again.");
      }
      setStatus("idle");
      modeRef.current = null;
      stopSpeech();
    };

    recognition.onend = () => {
      if (modeRef.current !== "speech") return;
      if (!stopRequestedRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setStatus("idle");
      modeRef.current = null;
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      setStatus("listening");
    } catch {
      stopSpeech();
      void startRecording();
    }
  }, [
    clearSilenceTimer,
    locale,
    onError,
    revealToward,
    scheduleSpeechAutoComplete,
    startRecording,
    stopSpeech,
  ]);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    clearSilenceTimer();
    if (modeRef.current === "speech") {
      const text = (revealTargetRef.current || valueRef.current).trim();
      stopSpeech();
      setStatus("idle");
      modeRef.current = null;
      if (text) finishWithText(text);
      return;
    }
    if (modeRef.current === "record") {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        // Manual stop still transcribes + auto-sends if we heard speech.
        hadSpeechRef.current = hadSpeechRef.current || chunksRef.current.length > 0;
        recorder.stop();
      } else {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    }
  }, [cleanupMedia, clearSilenceTimer, finishWithText, stopSpeech]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (status === "listening" || status === "recording") {
      stop();
      return;
    }
    if (status === "transcribing") return;
    // Prefer live Web Speech so text reveals while talking; Whisper is fallback.
    if (getSpeechRecognitionCtor()) startSpeech();
    else void startRecording();
  }, [enabled, startRecording, startSpeech, status, stop]);

  return {
    status,
    isActive: status === "listening" || status === "recording",
    isBusy: status === "transcribing",
    toggle,
    stop,
  };
}
