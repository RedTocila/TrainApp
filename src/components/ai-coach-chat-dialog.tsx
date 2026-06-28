"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AiChatClientLazy } from "@/components/ai-chat-client-lazy";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { CoachReadMeDialog } from "@/components/coach-read-me-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { SupportContactButton } from "@/components/support-contact-button";
import { Button } from "@/components/ui/button";

export function AiCoachChatDialog() {
  const {
    isOpen,
    closeChat,
    readMeOpen,
    openReadMe,
    closeReadMe,
    hasAcknowledgedReadMe,
    acknowledgeReadMe,
  } = useAiCoachChat();
  const platform = usePlatformCopy();
  const ai = platform.ai;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const main = document.querySelector<HTMLElement>(".dashboard-main");
    const prevMainOverflow = main?.style.overflow ?? "";
    const prevBodyOverflow = document.body.style.overflow;

    if (main) {
      main.style.overflow = "hidden";
    }
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (readMeOpen) closeReadMe();
        else closeChat();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (main) {
        main.style.overflow = prevMainOverflow;
      }
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen, closeChat, readMeOpen, closeReadMe]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-coach-chat-title"
      className="fixed inset-x-0 top-0 bottom-[var(--dashboard-mobile-nav-height,3.375rem)] z-[90] flex flex-col overflow-hidden bg-background lg:bottom-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="flex min-w-0 items-center gap-2.5">
          <AiCoachAvatar size="sm" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <h2 id="ai-coach-chat-title" className="text-base font-bold">
              Coach Alex
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={openReadMe}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {ai.readMeButton}
          </button>
          <SupportContactButton />
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
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <AiChatClientLazy embedded />
      </div>
      <CoachReadMeDialog
        open={readMeOpen}
        onClose={closeReadMe}
        onAccept={acknowledgeReadMe}
        title={ai.readMeTitle}
        points={ai.readMeBody}
        gotItLabel={ai.readMeGotIt}
        agreeLabel={ai.readMeAgreeLabel}
        required={!hasAcknowledgedReadMe}
      />
    </div>,
    document.body
  );
}
