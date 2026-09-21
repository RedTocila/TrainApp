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

export type VoiceDictationStatus = "idle" | "listening" | "recording" | "transcribing";

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function prefersWhisperFallback(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  // Web Speech is unreliable on iOS Safari and often blocked in Brave.
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg|FxiOS|OPiOS/i.test(ua)) return true;
  if (/Brave/i.test(ua)) return true;
  const nav = navigator as Navigator & { brave?: { isBrave?: unknown } };
  if (nav.brave) return true;
  return false;
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

export function useVoiceDictation({
  locale,
  value,
  onChange,
  onError,
  enabled = true,
}: {
  locale: string;
  value: string;
  onChange: (next: string) => void;
  onError: (message: string) => void;
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

  valueRef.current = value;

  const cleanupMedia = useCallback(() => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      stopSpeech();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
    };
  }, [cleanupMedia, stopSpeech]);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setStatus("transcribing");
      try {
        const form = new FormData();
        const type = blob.type || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
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
        onChange(joinText(baseRef.current, text));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Transcription failed");
      } finally {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    },
    [cleanupMedia, locale, onChange, onError]
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Voice input isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        if (!stopRequestedRef.current || blob.size < 200) {
          setStatus("idle");
          modeRef.current = null;
          cleanupMedia();
          if (blob.size < 200) onError("Recording was too short.");
          return;
        }
        void transcribeBlob(blob);
      };

      recorder.start(250);
      setStatus("recording");
    } catch {
      onError("Microphone permission is required for voice input.");
      setStatus("idle");
      modeRef.current = null;
      cleanupMedia();
    }
  }, [cleanupMedia, onError, transcribeBlob]);

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
    modeRef.current = "speech";
    stopRequestedRef.current = false;

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
        onChange(joinText(baseRef.current, interimChunk));
      } else {
        onChange(joinText(baseRef.current, interimChunk));
      }
    };

    recognition.onerror = (event) => {
      // Fall back to Whisper recording for unsupported / broken browsers.
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
        event.error === "service-not-allowed" ||
        event.error === "language-not-supported"
      ) {
        stopSpeech();
        void startRecording();
        return;
      }
      if (event.error !== "aborted" && event.error !== "no-speech") {
        onError("Couldn't hear that — try again.");
      }
      setStatus("idle");
      modeRef.current = null;
      stopSpeech();
    };

    recognition.onend = () => {
      if (modeRef.current !== "speech") return;
      if (!stopRequestedRef.current) {
        // Some browsers end after a pause; keep listening until user stops.
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
  }, [locale, onChange, onError, startRecording, stopSpeech]);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (modeRef.current === "speech") {
      stopSpeech();
      setStatus("idle");
      modeRef.current = null;
      return;
    }
    if (modeRef.current === "record") {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    }
  }, [cleanupMedia, stopSpeech]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (status === "listening" || status === "recording") {
      stop();
      return;
    }
    if (status === "transcribing") return;
    if (prefersWhisperFallback() || !getSpeechRecognitionCtor()) {
      void startRecording();
      return;
    }
    startSpeech();
  }, [enabled, startRecording, startSpeech, status, stop]);

  return {
    status,
    isActive: status === "listening" || status === "recording",
    isBusy: status === "transcribing",
    toggle,
    stop,
  };
}
