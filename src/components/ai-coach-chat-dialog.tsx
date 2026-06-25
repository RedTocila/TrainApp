"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AiChatClientLazy } from "@/components/ai-chat-client-lazy";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { Button } from "@/components/ui/button";

export function AiCoachChatDialog() {
  const { isOpen, closeChat } = useAiCoachChat();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeChat]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close chat"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={closeChat}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coach-chat-title"
        className="relative z-10 flex h-[min(85dvh,calc(100dvh-6rem-env(safe-area-inset-bottom,0px)))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AiCoachAvatar size="sm" className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <h2 id="ai-coach-chat-title" className="text-base font-bold">
                Coach Alex
              </h2>
              <p className="truncate text-xs text-muted-foreground">Sarcastic answers. Real advice.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={closeChat}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <AiChatClientLazy embedded />
      </div>
    </div>
  );
}
