"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DialogPortal } from "@/components/dialog-portal";
import { AiChatClientLazy } from "@/components/ai-chat-client-lazy";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { CoachReadMeDialog } from "@/components/coach-read-me-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { SupportContactButton } from "@/components/support-contact-button";
import { Button } from "@/components/ui/button";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";

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
  const [entered, setEntered] = useState(false);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (readMeOpen) closeReadMe();
        else closeChat();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeChat, readMeOpen, closeReadMe]);

  if (!isOpen) return null;

  return (
    <DialogPortal open={isOpen}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coach-chat-title"
        className={`fixed inset-0 z-[110] flex flex-col overflow-hidden bg-background transition-transform duration-150 ease-out ${
          entered ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.995]"
        }`}
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
    </div>
    </DialogPortal>
  );
}
