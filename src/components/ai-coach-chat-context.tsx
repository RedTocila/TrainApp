"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acknowledgeCoachReadMe,
  getReadMeAcknowledgments,
} from "@/lib/actions/read-me-acks";
import type { CoachChatMode } from "@/lib/ai/coach-chat-tools";
import { clearCoachChatCache } from "@/lib/coach-chat-cache";
import {
  hasCoachReadMeAcknowledged,
  setCoachReadMeAcknowledged,
} from "@/lib/coach-read-me-storage";

export type OpenAiCoachChatOptions = {
  /** Force Ask/Act before an auto-sent prompt (e.g. AI Build → Act). */
  mode?: CoachChatMode;
};

type AiCoachChatContextValue = {
  isOpen: boolean;
  openChat: (prompt?: string, options?: OpenAiCoachChatOptions) => void;
  closeChat: () => void;
  pendingPrompt: string | null;
  consumePendingPrompt: () => string | null;
  pendingMode: CoachChatMode | null;
  consumePendingMode: () => CoachChatMode | null;
  readMeOpen: boolean;
  openReadMe: () => void;
  closeReadMe: () => void;
  hasAcknowledgedReadMe: boolean;
  readMeHydrated: boolean;
  acknowledgeReadMe: () => void;
  canChat: boolean;
  /** Bumped by startNewChat so the chat client can reset without remounting. */
  chatResetToken: number;
  startNewChat: () => void;
};

const AiCoachChatContext = createContext<AiCoachChatContextValue | null>(null);

export function AiCoachChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const [pendingMode, setPendingMode] = useState<CoachChatMode | null>(null);
  const pendingModeRef = useRef<CoachChatMode | null>(null);
  const [readMeOpen, setReadMeOpen] = useState(false);
  const [hasAcknowledgedReadMe, setHasAcknowledgedReadMe] = useState(false);
  const [readMeHydrated, setReadMeHydrated] = useState(false);
  const [chatResetToken, setChatResetToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const localAck = hasCoachReadMeAcknowledged();
      if (localAck) {
        setHasAcknowledgedReadMe(true);
      }

      try {
        const remote = await getReadMeAcknowledgments();
        if (cancelled) return;

        if (remote.coach) {
          setCoachReadMeAcknowledged();
          setHasAcknowledgedReadMe(true);
        } else if (localAck) {
          // One-time migrate device ack → profile.
          const result = await acknowledgeCoachReadMe();
          if (!cancelled && !("error" in result)) {
            setHasAcknowledgedReadMe(true);
          }
        }
      } catch {
        // Offline / migration not applied — keep localStorage result.
      } finally {
        if (!cancelled) setReadMeHydrated(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isOpen && readMeHydrated && !hasAcknowledgedReadMe) {
      setReadMeOpen(true);
    }
  }, [isOpen, readMeHydrated, hasAcknowledgedReadMe]);

  const openChat = useCallback(
    (prompt?: string, options?: OpenAiCoachChatOptions) => {
      const trimmed = prompt?.trim() || null;
      pendingPromptRef.current = trimmed;
      setPendingPrompt(trimmed);
      const mode = options?.mode ?? null;
      pendingModeRef.current = mode;
      setPendingMode(mode);
      setIsOpen(true);
    },
    []
  );

  const closeChat = useCallback(() => {
    if (!hasAcknowledgedReadMe) {
      setReadMeOpen(false);
    }
    pendingPromptRef.current = null;
    setPendingPrompt(null);
    pendingModeRef.current = null;
    setPendingMode(null);
    setIsOpen(false);
  }, [hasAcknowledgedReadMe]);

  const consumePendingPrompt = useCallback(() => {
    const next = pendingPromptRef.current;
    pendingPromptRef.current = null;
    setPendingPrompt(null);
    return next;
  }, []);

  const consumePendingMode = useCallback(() => {
    const next = pendingModeRef.current;
    pendingModeRef.current = null;
    setPendingMode(null);
    return next;
  }, []);

  const openReadMe = useCallback(() => setReadMeOpen(true), []);
  const closeReadMe = useCallback(() => {
    setReadMeOpen(false);
  }, []);
  const acknowledgeReadMe = useCallback(() => {
    setCoachReadMeAcknowledged();
    setHasAcknowledgedReadMe(true);
    setReadMeOpen(false);
    void acknowledgeCoachReadMe();
  }, []);

  const canChat = readMeHydrated && hasAcknowledgedReadMe;

  const startNewChat = useCallback(() => {
    clearCoachChatCache();
    setChatResetToken((n) => n + 1);
  }, []);

  return (
    <AiCoachChatContext.Provider
      value={{
        isOpen,
        openChat,
        closeChat,
        pendingPrompt,
        consumePendingPrompt,
        pendingMode,
        consumePendingMode,
        readMeOpen,
        openReadMe,
        closeReadMe,
        hasAcknowledgedReadMe,
        readMeHydrated,
        acknowledgeReadMe,
        canChat,
        chatResetToken,
        startNewChat,
      }}
    >
      {children}
    </AiCoachChatContext.Provider>
  );
}

export function useAiCoachChat() {
  const context = useContext(AiCoachChatContext);
  if (!context) {
    throw new Error("useAiCoachChat must be used within AiCoachChatProvider");
  }
  return context;
}
