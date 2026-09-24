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

/** Chrome Web Speech rarely understands Albanian; use Whisper instead. */
function preferWhisper(locale: string): boolean {
  return locale === "al";
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

function micErrorMessage(
  error: unknown,
  permissionCopy: string,
  unsupportedCopy: string
): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Voice input needs a secure connection (HTTPS).";
  }
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return permissionCopy;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Microphone is busy in another app — close it and try again.";
  }
  if (name === "OverconstrainedError") {
    return "Couldn't open the microphone with the requested settings.";
  }
  return unsupportedCopy;
}

/**
 * Ensure mic permission via getUserMedia before SpeechRecognition.
 * Web Speech often reports not-allowed even when the OS mic toggle is on;
 * unlocking the device mic first (and falling back to MediaRecorder) fixes most cases.
 */
async function ensureMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export function useVoiceDictation({
  locale,
  value,
  onChange,
  onError,
  enabled = true,
  permissionMessage,
  unsupportedMessage,
}: {
  locale: string;
  value: string;
  onChange: (next: string) => void;
  onError: (message: string) => void;
  enabled?: boolean;
  permissionMessage: string;
  unsupportedMessage: string;
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const revealTargetRef = useRef(value);
  const revealShownRef = useRef(value);
  const revealRafRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const speechFailedRef = useRef(false);

  valueRef.current = value;
  onChangeRef.current = onChange;

  const stopReveal = useCallback(() => {
    if (revealRafRef.current != null) {
      cancelAnimationFrame(revealRafRef.current);
      revealRafRef.current = null;
    }
  }, []);

  const flushReveal = useCallback(
    (text: string) => {
      stopReveal();
      revealTargetRef.current = text;
      revealShownRef.current = text;
      valueRef.current = text;
      onChangeRef.current(text);
    },
    [stopReveal]
  );

  const revealTick = useCallback(() => {
    const target = revealTargetRef.current;
    let shown = revealShownRef.current;

    if (shown === target) {
      revealRafRef.current = null;
      return;
    }

    if (target.startsWith(shown)) {
      const remaining = target.length - shown.length;
      const step = remaining > 24 ? 4 : remaining > 10 ? 2 : 1;
      shown = target.slice(0, shown.length + step);
    } else if (shown.startsWith(target)) {
      const step = Math.max(1, Math.ceil((shown.length - target.length) / 3));
      shown = shown.slice(0, Math.max(target.length, shown.length - step));
    } else {
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

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      stopReveal();
      stopSpeech();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
    };
  }, [cleanupMedia, stopReveal, stopSpeech]);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
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
        // Fill the composer only — user taps Send manually.
        flushReveal(joinText(baseRef.current, text));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Transcription failed");
      } finally {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    },
    [cleanupMedia, flushReveal, locale, onError]
  );

  const startRecording = useCallback(
    async (existingStream?: MediaStream) => {
      if (typeof MediaRecorder === "undefined") {
        onError(unsupportedMessage);
        return;
      }

      try {
        const stream = existingStream ?? (await ensureMicStream());
        // If we received a stream from a prior unlock, don't stop it until recorder ends.
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
          cleanupAnalyser();
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || mimeType || "audio/webm",
          });
          if (!stopRequestedRef.current || blob.size < 200) {
            setStatus("idle");
            modeRef.current = null;
            cleanupMedia();
            if (stopRequestedRef.current && blob.size < 200) {
              onError("Recording was too short.");
            }
            return;
          }
          void transcribeBlob(blob);
        };

        recorder.start(250);
        setStatus("recording");
      } catch (error) {
        onError(
          micErrorMessage(error, permissionMessage, unsupportedMessage)
        );
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    },
    [
      cleanupAnalyser,
      cleanupMedia,
      onError,
      permissionMessage,
      transcribeBlob,
      unsupportedMessage,
    ]
  );

  const startSpeech = useCallback(
    async (unlockedStream?: MediaStream) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor || speechFailedRef.current) {
        void startRecording(unlockedStream);
        return;
      }

      // Release the unlock stream — SpeechRecognition uses its own mic path.
      if (unlockedStream) {
        for (const track of unlockedStream.getTracks()) track.stop();
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
        revealToward(joinText(baseRef.current, interimChunk));
      };

      recognition.onerror = (event) => {
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          // Speech API denied ≠ mic denied. Fall back to MediaRecorder + Whisper.
          speechFailedRef.current = true;
          stopSpeech();
          modeRef.current = null;
          void startRecording();
          return;
        }
        if (
          event.error === "network" ||
          event.error === "language-not-supported"
        ) {
          speechFailedRef.current = true;
          stopSpeech();
          modeRef.current = null;
          void startRecording();
          return;
        }
        if (event.error === "no-speech") {
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
        speechFailedRef.current = true;
        stopSpeech();
        void startRecording();
      }
    },
    [locale, onError, revealToward, startRecording, stopSpeech]
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (modeRef.current === "speech") {
      // Finalize whatever we heard into the input — do not auto-send.
      const text = (revealTargetRef.current || valueRef.current).trim();
      stopSpeech();
      setStatus("idle");
      modeRef.current = null;
      if (text) flushReveal(text);
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
  }, [cleanupMedia, flushReveal, stopSpeech]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (status === "listening" || status === "recording") {
      stop();
      return;
    }
    if (status === "transcribing") return;

    void (async () => {
      // Unlock real mic permission first — fixes false "give access" from Web Speech.
      let stream: MediaStream | undefined;
      try {
        stream = await ensureMicStream();
      } catch (error) {
        onError(
          micErrorMessage(error, permissionMessage, unsupportedMessage)
        );
        return;
      }

      if (
        !preferWhisper(locale) &&
        getSpeechRecognitionCtor() &&
        !speechFailedRef.current
      ) {
        await startSpeech(stream);
      } else {
        await startRecording(stream);
      }
    })();
  }, [
    enabled,
    locale,
    onError,
    permissionMessage,
    startRecording,
    startSpeech,
    status,
    stop,
    unsupportedMessage,
  ]);

  return {
    status,
    isActive: status === "listening" || status === "recording",
    isBusy: status === "transcribing",
    toggle,
    stop,
  };
}
