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

type DictationMode = "speech" | "record" | "hybrid" | null;

export type VoiceDictationStatus =
  | "idle"
  | "listening"
  | "recording"
  | "transcribing";

/** Server interim fallback when browser speech isn't usable. */
const INTERIM_TRANSCRIBE_MS = 700;
const INTERIM_MIN_BYTES = 900;

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

/** Albanian: live browser speech + accurate server final. */
function needsServerFinal(locale: string): boolean {
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

async function requestTranscript(
  blob: Blob,
  locale: string
): Promise<string> {
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
  return text;
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
  const speechLiveFinalRef = useRef("");
  const dictatedRef = useRef(value);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const modeRef = useRef<DictationMode>(null);
  const stopRequestedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const speechFailedRef = useRef(false);
  const liveSpeechOkRef = useRef(false);
  const interimTimerRef = useRef<number | null>(null);
  const interimInFlightRef = useRef(false);
  const lastInterimBytesRef = useRef(0);
  const lastInterimTextRef = useRef("");
  const recorderMimeRef = useRef("audio/webm");

  valueRef.current = value;
  onChangeRef.current = onChange;

  /** Instant text update — no typewriter / delete-retype animation. */
  const setDictatedText = useCallback((text: string) => {
    dictatedRef.current = text;
    valueRef.current = text;
    onChangeRef.current(text);
  }, []);

  const stopInterimTimer = useCallback(() => {
    if (interimTimerRef.current != null) {
      window.clearInterval(interimTimerRef.current);
      interimTimerRef.current = null;
    }
  }, []);

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
    stopInterimTimer();
    cleanupAnalyser();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    lastInterimBytesRef.current = 0;
    lastInterimTextRef.current = "";
    interimInFlightRef.current = false;
    liveSpeechOkRef.current = false;
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
  }, [cleanupAnalyser, stopInterimTimer]);

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
      stopInterimTimer();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
    };
  }, [cleanupMedia, stopInterimTimer, stopSpeech]);

  const buildRecordingBlob = useCallback(() => {
    return new Blob(chunksRef.current, {
      type: recorderMimeRef.current || "audio/webm",
    });
  }, []);

  const runInterimTranscribe = useCallback(async () => {
    if (liveSpeechOkRef.current) return;
    if (interimInFlightRef.current) return;
    if (
      (modeRef.current !== "record" && modeRef.current !== "hybrid") ||
      stopRequestedRef.current
    ) {
      return;
    }
    if (chunksRef.current.length === 0) return;

    const blob = buildRecordingBlob();
    if (blob.size < INTERIM_MIN_BYTES) return;
    if (blob.size - lastInterimBytesRef.current < 500) return;

    interimInFlightRef.current = true;
    lastInterimBytesRef.current = blob.size;
    try {
      const text = await requestTranscript(blob, locale);
      if (
        (modeRef.current === "record" || modeRef.current === "hybrid") &&
        !stopRequestedRef.current &&
        !liveSpeechOkRef.current &&
        text.trim()
      ) {
        const next = text.trim();
        const prev = lastInterimTextRef.current;
        // Only grow (or first fill) — avoid Whisper rewrites that shrink/replace mid-phrase.
        if (!prev || next.length >= prev.length || next.startsWith(prev.slice(0, 12))) {
          lastInterimTextRef.current = next;
          setDictatedText(joinText(baseRef.current, next));
        }
      }
    } catch {
      /* final pass still runs on stop */
    } finally {
      interimInFlightRef.current = false;
    }
  }, [buildRecordingBlob, locale, setDictatedText]);

  const startServerInterimPolling = useCallback(() => {
    stopInterimTimer();
    interimTimerRef.current = window.setInterval(() => {
      void runInterimTranscribe();
    }, INTERIM_TRANSCRIBE_MS);
    window.setTimeout(() => {
      void runInterimTranscribe();
    }, 450);
  }, [runInterimTranscribe, stopInterimTimer]);

  const transcribeFinalBlob = useCallback(
    async (blob: Blob) => {
      setStatus("transcribing");
      try {
        const text = await requestTranscript(blob, locale);
        setDictatedText(joinText(baseRef.current, text));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Transcription failed");
      } finally {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    },
    [cleanupMedia, locale, onError, setDictatedText]
  );

  const startRecorder = useCallback(
    async (stream: MediaStream, mode: "record" | "hybrid") => {
      if (typeof MediaRecorder === "undefined") {
        onError(unsupportedMessage);
        return false;
      }

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorderMimeRef.current = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      lastInterimBytesRef.current = 0;
      lastInterimTextRef.current = "";
      interimInFlightRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        onError("Couldn't record audio.");
        setStatus("idle");
        modeRef.current = null;
        stopSpeech();
        cleanupMedia();
      };
      recorder.onstop = () => {
        stopInterimTimer();
        cleanupAnalyser();
        const blob = buildRecordingBlob();
        if (!stopRequestedRef.current || blob.size < 200) {
          setStatus("idle");
          modeRef.current = null;
          cleanupMedia();
          if (stopRequestedRef.current && blob.size < 200) {
            onError("Recording was too short.");
          }
          return;
        }

        // Hybrid with working live speech: keep what the user already sees.
        // Skip the late Whisper rewrite that caused post-stop flicker.
        if (modeRef.current === "hybrid" && liveSpeechOkRef.current) {
          const live = dictatedRef.current.trim();
          if (live && live !== baseRef.current.trim()) {
            setDictatedText(live);
            setStatus("idle");
            modeRef.current = null;
            cleanupMedia();
            return;
          }
        }

        void transcribeFinalBlob(blob);
      };

      recorder.start(250);
      modeRef.current = mode;
      if (mode === "hybrid") {
        setStatus("listening");
      } else {
        setStatus("recording");
        startServerInterimPolling();
      }
      return true;
    },
    [
      buildRecordingBlob,
      cleanupAnalyser,
      cleanupMedia,
      onError,
      setDictatedText,
      startServerInterimPolling,
      stopInterimTimer,
      stopSpeech,
      transcribeFinalBlob,
      unsupportedMessage,
    ]
  );

  const startRecorderFallback = useCallback(
    (stream?: MediaStream) => {
      void (async () => {
        try {
          const s = stream ?? (await ensureMicStream());
          baseRef.current = valueRef.current;
          dictatedRef.current = valueRef.current;
          speechLiveFinalRef.current = "";
          stopRequestedRef.current = false;
          await startRecorder(s, "record");
        } catch (error) {
          onError(
            micErrorMessage(error, permissionMessage, unsupportedMessage)
          );
        }
      })();
    },
    [onError, permissionMessage, startRecorder, unsupportedMessage]
  );

  const applySpeechResult = useCallback(
    (event: SpeechRecognitionEventLike) => {
      liveSpeechOkRef.current = true;
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += piece;
        else interimChunk += piece;
      }
      if (finalChunk.trim()) {
        speechLiveFinalRef.current = joinText(
          speechLiveFinalRef.current,
          finalChunk
        );
      }
      setDictatedText(
        joinText(
          baseRef.current,
          joinText(speechLiveFinalRef.current, interimChunk)
        )
      );
    },
    [setDictatedText]
  );

  const startSpeechOnly = useCallback(
    async (unlockedStream?: MediaStream) => {
      if (unlockedStream) {
        for (const track of unlockedStream.getTracks()) track.stop();
      }

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor || speechFailedRef.current) {
        startRecorderFallback();
        return;
      }

      baseRef.current = valueRef.current;
      dictatedRef.current = valueRef.current;
      speechLiveFinalRef.current = "";
      modeRef.current = "speech";
      stopRequestedRef.current = false;
      liveSpeechOkRef.current = false;

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang(locale);
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        applySpeechResult(event);
      };

      recognition.onerror = (event) => {
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed" ||
          event.error === "network" ||
          event.error === "language-not-supported"
        ) {
          speechFailedRef.current = true;
          stopSpeech();
          modeRef.current = null;
          startRecorderFallback();
          return;
        }
        if (event.error === "no-speech") return;
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
        startRecorderFallback();
      }
    },
    [
      applySpeechResult,
      locale,
      onError,
      startRecorderFallback,
      stopSpeech,
    ]
  );

  const startHybridAlbanian = useCallback(
    async (stream: MediaStream) => {
      baseRef.current = valueRef.current;
      dictatedRef.current = valueRef.current;
      speechLiveFinalRef.current = "";
      stopRequestedRef.current = false;
      liveSpeechOkRef.current = false;

      const recorderOk = await startRecorder(stream, "hybrid");
      if (!recorderOk) return;

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor || speechFailedRef.current) {
        modeRef.current = "record";
        setStatus("recording");
        startServerInterimPolling();
        return;
      }

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang(locale);
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        stopInterimTimer();
        applySpeechResult(event);
      };

      recognition.onerror = (event) => {
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed" ||
          event.error === "network" ||
          event.error === "language-not-supported"
        ) {
          speechFailedRef.current = true;
          liveSpeechOkRef.current = false;
          stopSpeech();
          if (modeRef.current === "hybrid" || modeRef.current === "record") {
            modeRef.current = "record";
            setStatus("recording");
            startServerInterimPolling();
          }
          return;
        }
        if (event.error === "no-speech") return;
        liveSpeechOkRef.current = false;
      };

      recognition.onend = () => {
        if (stopRequestedRef.current) {
          recognitionRef.current = null;
          return;
        }
        if (modeRef.current !== "hybrid" && modeRef.current !== "record") {
          return;
        }
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
          liveSpeechOkRef.current = false;
          if (modeRef.current === "hybrid") {
            modeRef.current = "record";
            setStatus("recording");
            startServerInterimPolling();
          }
        }
      };

      try {
        recognition.start();
        setStatus("listening");
      } catch {
        speechFailedRef.current = true;
        stopSpeech();
        modeRef.current = "record";
        setStatus("recording");
        startServerInterimPolling();
      }
    },
    [
      applySpeechResult,
      locale,
      startRecorder,
      startServerInterimPolling,
      stopInterimTimer,
      stopSpeech,
    ]
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    const mode = modeRef.current;

    if (mode === "speech") {
      const text = dictatedRef.current.trim();
      stopSpeech();
      setStatus("idle");
      modeRef.current = null;
      if (text) setDictatedText(text);
      return;
    }

    if (mode === "hybrid" || mode === "record") {
      stopInterimTimer();
      stopSpeech();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        setStatus("idle");
        modeRef.current = null;
        cleanupMedia();
      }
    }
  }, [cleanupMedia, setDictatedText, stopInterimTimer, stopSpeech]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (status === "listening" || status === "recording") {
      stop();
      return;
    }
    if (status === "transcribing") return;

    void (async () => {
      let stream: MediaStream | undefined;
      try {
        stream = await ensureMicStream();
      } catch (error) {
        onError(
          micErrorMessage(error, permissionMessage, unsupportedMessage)
        );
        return;
      }

      if (needsServerFinal(locale)) {
        await startHybridAlbanian(stream);
        return;
      }

      if (getSpeechRecognitionCtor() && !speechFailedRef.current) {
        await startSpeechOnly(stream);
      } else {
        startRecorderFallback(stream);
      }
    })();
  }, [
    enabled,
    locale,
    onError,
    permissionMessage,
    startHybridAlbanian,
    startRecorderFallback,
    startSpeechOnly,
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
