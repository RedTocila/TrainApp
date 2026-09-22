"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
/** Keep in sync with `--duration-page` in globals.css */
const PAGE_MS = 320;

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
  const [present, setPresent] = useState(isOpen);
  const [entered, setEntered] = useState(false);
  const openRef = useRef(isOpen);
  const frame = useVisualViewportFrame(present);
  const opaqueBg = useOpaqueChatBg();

  useEffect(() => {
    openRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timeoutId = 0;

    if (isOpen) {
      raf1 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setPresent(true);
        setEntered(false);
        raf2 = window.requestAnimationFrame(() => {
          if (cancelled || !openRef.current) return;
          setEntered(true);
        });
      });
    } else {
      raf1 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setEntered(false);
      });
      timeoutId = window.setTimeout(() => {
        if (cancelled || openRef.current) return;
        setPresent(false);
      }, PAGE_MS);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [isOpen]);

  useLockBodyScroll(present);

  useEffect(() => {
    if (!present || !isOpen) return;

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
  }, [present, isOpen, closeChat, readMeOpen, closeReadMe]);

  if (!present) return null;

  return (
    <DialogPortal open={present}>
      {/* Full-screen opaque backdrop — covers whatever is behind the chat. */}
      <div
        aria-hidden
        data-open={entered ? "true" : "false"}
        className="overlay-fullscreen pointer-events-none fixed inset-0 z-[110]"
        style={{ backgroundColor: opaqueBg }}
      />
      {/* Only when the keyboard is open: paint the band under the visual viewport. */}
      {frame.keyboardOpen ? (
        <div
          aria-hidden
          data-open={entered ? "true" : "false"}
          className="overlay-fullscreen pointer-events-none fixed inset-x-0 z-[110]"
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
        data-open={entered ? "true" : "false"}
        className="overlay-chat-page fixed inset-x-0 z-[111] flex flex-col overflow-hidden"
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
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={closeChat}
              aria-label={platform.common.back}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <AiCoachAvatar size="sm" className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <h2 id="ai-coach-chat-title" className="text-base font-bold">
                Coach Alex
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={openReadMe}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {ai.readMeButton}
          </button>
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
