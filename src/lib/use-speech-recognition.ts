"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: {
    isFinal: boolean;
    0: { transcript: string };
  };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function getLanguageCandidates(preferred: string): string[] {
  const candidates = [preferred];
  if (typeof navigator !== "undefined" && navigator.language) {
    candidates.push(navigator.language);
  }
  candidates.push("en-US");
  return [...new Set(candidates.filter(Boolean))];
}

function mapSpeechError(error: string): string | null {
  switch (error) {
    case "aborted":
    case "no-speech":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow the mic in browser settings.";
    case "audio-capture":
      return "No microphone found. Check your device settings.";
    case "network":
      return "Voice input needs an internet connection. Try again when you're online.";
    case "language-not-supported":
      return null;
    default:
      return "Could not recognize speech. Try again.";
  }
}

async function ensureMicrophoneAccess(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export const VOICE_SILENCE_MS = 1000;

export function useSpeechRecognition({
  lang,
  onTranscript,
  onSilence,
  onError,
  silenceMs = VOICE_SILENCE_MS,
}: {
  lang: string;
  onTranscript: (transcript: string) => void;
  onSilence?: (transcript: string) => void;
  onError?: (message: string) => void;
  silenceMs?: number;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef("");
  const latestTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onSilenceRef = useRef(onSilence);
  const onErrorRef = useRef(onError);
  const langCandidatesRef = useRef(getLanguageCandidates(lang));
  const silenceMsRef = useRef(silenceMs);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    langCandidatesRef.current = getLanguageCandidates(lang);
  }, [lang]);

  useEffect(() => {
    silenceMsRef.current = silenceMs;
  }, [silenceMs]);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const teardown = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      clearSilenceTimer();
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setIsListening(false);
    },
    [clearSilenceTimer]
  );

  const scheduleSilenceTimer = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current !== recognition) return;
        const text = latestTranscriptRef.current.trim();
        if (text) {
          onSilenceRef.current?.(text);
        }
        recognition.stop();
      }, silenceMsRef.current);
    },
    [clearSilenceTimer]
  );

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return;
    }
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, [clearSilenceTimer]);

  const beginRecognition = useCallback(
    (baseText: string, langIndex = 0) => {
      const SpeechRecognition = getSpeechRecognitionConstructor();
      const candidates = langCandidatesRef.current;
      if (!SpeechRecognition || langIndex >= candidates.length) {
        onErrorRef.current?.("Voice input is not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = candidates[langIndex];
      baseTextRef.current = baseText;
      latestTranscriptRef.current = baseText.trim();

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        const spacer = baseTextRef.current && transcript ? " " : "";
        const next = `${baseTextRef.current}${spacer}${transcript}`
          .replace(/\s+/g, " ")
          .trimStart();
        latestTranscriptRef.current = next;
        onTranscriptRef.current(next);
        scheduleSilenceTimer(recognition);
      };

      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return;

        if (event.error === "language-not-supported" && langIndex + 1 < candidates.length) {
          recognitionRef.current = null;
          recognition.abort();
          beginRecognition(baseText, langIndex + 1);
          return;
        }

        const message = mapSpeechError(event.error);
        if (message) {
          onErrorRef.current?.(message);
        }
        teardown(recognition);
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        teardown(recognition);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
        scheduleSilenceTimer(recognition);
      } catch {
        if (langIndex + 1 < candidates.length) {
          beginRecognition(baseText, langIndex + 1);
          return;
        }
        onErrorRef.current?.("Could not start voice input. Try again.");
        teardown(recognition);
      }
    },
    [scheduleSilenceTimer, teardown]
  );

  const startListening = useCallback(
    async (baseText = "") => {
      const SpeechRecognition = getSpeechRecognitionConstructor();
      if (!SpeechRecognition) {
        onErrorRef.current?.("Voice input is not supported in this browser.");
        return;
      }

      const micReady = await ensureMicrophoneAccess();
      if (!micReady) {
        onErrorRef.current?.("Microphone access was denied. Allow the mic in browser settings.");
        return;
      }

      const active = recognitionRef.current;
      if (active) {
        active.abort();
        recognitionRef.current = null;
      }

      beginRecognition(baseText);
    },
    [beginRecognition]
  );

  const toggleListening = useCallback(
    (baseText = "") => {
      if (isListening) {
        stopListening();
        return;
      }
      void startListening(baseText);
    },
    [isListening, startListening, stopListening]
  );

  useEffect(
    () => () => {
      clearSilenceTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [clearSilenceTimer]
  );

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
