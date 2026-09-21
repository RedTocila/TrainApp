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

/**
 * Hard opaque fills — never `var(--background)` alone (dashboard photo cards
 * override it to translucent rgba, and some browsers resolve that through).
 */
const OPAQUE_DARK = "#121214";
const OPAQUE_LIGHT = "#f4f4f5";

function useOpaqueChatBg(): string {
  const [bg, setBg] = useState(OPAQUE_DARK);

  useEffect(() => {
    const read = () => {
      const light = document.documentElement.classList.contains("light");
      setBg(light ? OPAQUE_LIGHT : OPAQUE_DARK);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return bg;
}

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
  const opaqueBg = useOpaqueChatBg();

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

  return (
    <DialogPortal open={isOpen}>
      {/* Full-screen opaque backdrop — covers whatever is behind the chat. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[110]"
        style={{ backgroundColor: opaqueBg }}
      />
      {/* Only when the keyboard is open: paint the band under the visual viewport. */}
      {frame.keyboardOpen ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 z-[110]"
          style={{
            top: frame.underlayTop,
            height: frame.underlayHeight,
            backgroundColor: opaqueBg,
          }}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coach-chat-title"
        className={`fixed inset-x-0 z-[111] flex flex-col overflow-hidden transition-transform duration-150 ease-out ${
          entered ? "translate-y-0" : "translate-y-1"
        }`}
        style={{
          top: frame.offsetTop,
          height: frame.height,
          backgroundColor: opaqueBg,
          // Soft skirt under the sheet for iOS keyboard / accessory chrome.
          boxShadow: frame.keyboardOpen
            ? `0 ${Math.max(frame.keyboardBand, 120)}px 0 0 ${opaqueBg}`
            : undefined,
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
          style={{ backgroundColor: opaqueBg }}
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
          style={{ backgroundColor: opaqueBg }}
        >
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
