"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DialogPortal } from "@/components/dialog-portal";
import { AiChatClientLazy } from "@/components/ai-chat-client-lazy";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { CoachReadMeDialog } from "@/components/coach-read-me-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useVisualViewportFrame } from "@/hooks/use-visual-viewport-frame";

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
  const frame = useVisualViewportFrame(isOpen);

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
      {/*
        Layout + keyboard-band mask. The chat panel only covers the visual
        viewport; iOS keeps a translucent strip (and sometimes a gap) below
        it where dashboard content would otherwise show through.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[110] w-full bg-background"
        style={{ height: frame.maskHeight }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-[110] bg-background"
        style={{
          top: frame.underlayTop,
          height: frame.underlayHeight,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coach-chat-title"
        className={`fixed inset-x-0 z-[111] flex flex-col overflow-hidden bg-background shadow-[0_48px_0_0_var(--background)] transition-transform duration-150 ease-out ${
          entered ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.995]"
        }`}
        style={{
          top: frame.offsetTop,
          height: frame.height,
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
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
        <div className="flex min-h-0 flex-1 flex-col bg-background">
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
