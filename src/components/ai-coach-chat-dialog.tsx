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

/** Opaque fill — never inherit translucent dashboard photo-card tokens. */
const OPAQUE_BG = "var(--background, #121214)";

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
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
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

  // Paint past the visual viewport into the keyboard / browser-chrome band.
  const skirt = Math.max(frame.keyboardBand, 280);
  const sheetHeight = frame.height + skirt;

  return (
    <DialogPortal open={isOpen}>
      {/*
        Full opaque masks keyed to visualViewport — never use layout
        `bottom: 0` alone (breaks when iOS shifts offsetTop with the keyboard).
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[110] w-full"
        style={{ height: frame.maskHeight, backgroundColor: OPAQUE_BG }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-[110]"
        style={{
          top: frame.underlayTop,
          height: frame.underlayHeight,
          backgroundColor: OPAQUE_BG,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coach-chat-title"
        className={`fixed inset-x-0 z-[111] flex flex-col overflow-hidden transition-transform duration-150 ease-out ${
          entered ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.995]"
        }`}
        style={{
          top: frame.offsetTop,
          height: sheetHeight,
          backgroundColor: OPAQUE_BG,
          // Extra paint below the sheet for browsers that clip fixed layers oddly.
          boxShadow: `0 ${skirt + 240}px 0 0 ${OPAQUE_BG}`,
        }}
      >
        <div
          className="flex min-h-0 w-full flex-col"
          style={{ height: frame.height, maxHeight: frame.height }}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
            style={{ backgroundColor: OPAQUE_BG }}
          >
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
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ backgroundColor: OPAQUE_BG }}
          >
            <AiChatClientLazy embedded />
          </div>
        </div>
        {/* Opaque extension into the keyboard / browser-nav band */}
        <div
          aria-hidden
          className="w-full shrink-0"
          style={{ height: skirt, backgroundColor: OPAQUE_BG }}
        />
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
