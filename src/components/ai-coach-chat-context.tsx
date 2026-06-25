"use client";

import { createContext, useCallback, useContext, useState } from "react";

type AiCoachChatContextValue = {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
};

const AiCoachChatContext = createContext<AiCoachChatContextValue | null>(null);

export function AiCoachChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  return (
    <AiCoachChatContext.Provider value={{ isOpen, openChat, closeChat }}>
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
