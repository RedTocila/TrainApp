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
  hasCoachReadMeAcknowledged,
  setCoachReadMeAcknowledged,
} from "@/lib/coach-read-me-storage";

type AiCoachChatContextValue = {
  isOpen: boolean;
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  pendingPrompt: string | null;
  consumePendingPrompt: () => string | null;
  readMeOpen: boolean;
  openReadMe: () => void;
  closeReadMe: () => void;
  hasAcknowledgedReadMe: boolean;
  readMeHydrated: boolean;
  acknowledgeReadMe: () => void;
  canChat: boolean;
};

const AiCoachChatContext = createContext<AiCoachChatContextValue | null>(null);

export function AiCoachChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const [readMeOpen, setReadMeOpen] = useState(false);
  const [hasAcknowledgedReadMe, setHasAcknowledgedReadMe] = useState(false);
  const [readMeHydrated, setReadMeHydrated] = useState(false);

  useEffect(() => {
    setHasAcknowledgedReadMe(hasCoachReadMeAcknowledged());
    setReadMeHydrated(true);
  }, []);

  useEffect(() => {
    if (isOpen && readMeHydrated && !hasAcknowledgedReadMe) {
      setReadMeOpen(true);
    }
  }, [isOpen, readMeHydrated, hasAcknowledgedReadMe]);

  const openChat = useCallback((prompt?: string) => {
    const trimmed = prompt?.trim() || null;
    pendingPromptRef.current = trimmed;
    setPendingPrompt(trimmed);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    if (!hasAcknowledgedReadMe) {
      setReadMeOpen(false);
    }
    pendingPromptRef.current = null;
    setPendingPrompt(null);
    setIsOpen(false);
  }, [hasAcknowledgedReadMe]);

  const consumePendingPrompt = useCallback(() => {
    const next = pendingPromptRef.current;
    pendingPromptRef.current = null;
    setPendingPrompt(null);
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
  }, []);

  const canChat = readMeHydrated && hasAcknowledgedReadMe;

  return (
    <AiCoachChatContext.Provider
      value={{
        isOpen,
        openChat,
        closeChat,
        pendingPrompt,
        consumePendingPrompt,
        readMeOpen,
        openReadMe,
        closeReadMe,
        hasAcknowledgedReadMe,
        readMeHydrated,
        acknowledgeReadMe,
        canChat,
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
