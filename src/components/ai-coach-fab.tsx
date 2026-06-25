"use client";

import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { cn } from "@/lib/utils";

export function AiCoachFab() {
  const { isOpen, openChat } = useAiCoachChat();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={openChat}
      aria-label="Ask AI Coach"
      className={cn(
        "fixed z-40 overflow-hidden rounded-full",
        "border-2 border-primary/40 shadow-lg shadow-primary/30",
        "transition-transform hover:scale-105 active:scale-95",
        "bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px))+10px)] right-4",
        "lg:bottom-4 lg:right-4"
      )}
    >
      <AiCoachAvatar size="fab" className="h-14 w-14" />
    </button>
  );
}
