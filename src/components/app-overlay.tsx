"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { DialogPortal } from "@/components/dialog-portal";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useVisualViewportFrame } from "@/hooks/use-visual-viewport-frame";
import { cn } from "@/lib/utils";

/** Above dashboard mobile nav (z-100) and common chrome. */
export const APP_DIALOG_Z_INDEX = 120;

const DISMISS_THRESHOLD_PX = 88;
const DISMISS_VELOCITY = 0.55;

type OverlayDismissContextValue = {
  onDismiss: (() => void) | null;
};

const OverlayDismissContext = createContext<OverlayDismissContextValue>({
  onDismiss: null,
});

export function AppOverlay({
  open,
  onClose,
  children,
  zIndex = APP_DIALOG_Z_INDEX,
  /** Full-bleed surface (photo review, immersive flows). */
  fullscreen = false,
  /** Disable backdrop dismiss (e.g. while saving). */
  closeOnBackdrop = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  fullscreen?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}) {
  useLockBodyScroll(open);
  const frame = useVisualViewportFrame(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnBackdrop) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, closeOnBackdrop]);

  const dismissValue = useMemo(
    () => ({ onDismiss: closeOnBackdrop ? onClose : null }),
    [closeOnBackdrop, onClose]
  );

  return (
    <DialogPortal open={open}>
      <OverlayDismissContext.Provider value={dismissValue}>
        <div
          className={cn(
            "fixed inset-x-0 flex justify-center",
            fullscreen ? "flex-col" : "items-end sm:items-center sm:p-4",
            className
          )}
          style={{
            zIndex,
            top: fullscreen ? 0 : frame.offsetTop,
            height: fullscreen ? "100dvh" : frame.height,
          }}
        >
          {!fullscreen ? (
            <button
              type="button"
              aria-label="Close"
              className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
              onClick={closeOnBackdrop ? onClose : undefined}
              disabled={!closeOnBackdrop}
            />
          ) : null}
          {children}
        </div>
      </OverlayDismissContext.Provider>
    </DialogPortal>
  );
}

function getScrollableAncestor(start: EventTarget | null, root: HTMLElement) {
  let node = start instanceof Element ? start : null;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const canScrollY =
        (style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1;
      if (canScrollY) return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Panel surface for AppOverlay: bottom sheet on mobile, centered card on sm+.
 * Pull down (from the handle or while scrolled to the top) to dismiss.
 */
export function AppOverlayPanel({
  children,
  className,
  maxWidth = "max-w-lg",
  fullscreen = false,
  showHandle = true,
  dismissible,
  role = "dialog",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
  fullscreen?: boolean;
  showHandle?: boolean;
  /** Override context dismiss; false disables pull-to-close. */
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const { onDismiss } = useContext(OverlayDismissContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const draggingRef = useRef(false);
  const lastYRef = useRef(0);
  const lastTsRef = useRef(0);
  const velocityRef = useRef(0);
  const canDismiss = dismissible !== false && Boolean(onDismiss) && !fullscreen;

  const resetTransform = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
    panel.style.transform = "";
    window.setTimeout(() => {
      if (panel) panel.style.transition = "";
    }, 220);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !canDismiss) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const scrollable = getScrollableAncestor(event.target, panel);
      if (scrollable && scrollable.scrollTop > 2) {
        draggingRef.current = false;
        return;
      }
      const y = event.touches[0]?.clientY ?? 0;
      startYRef.current = y;
      lastYRef.current = y;
      lastTsRef.current = event.timeStamp;
      velocityRef.current = 0;
      dragYRef.current = 0;
      draggingRef.current = true;
      panel.style.transition = "none";
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!draggingRef.current) return;
      const y = event.touches[0]?.clientY ?? 0;
      const dy = y - startYRef.current;
      const dt = Math.max(1, event.timeStamp - lastTsRef.current);
      velocityRef.current = (y - lastYRef.current) / dt;
      lastYRef.current = y;
      lastTsRef.current = event.timeStamp;

      if (dy <= 0) {
        dragYRef.current = 0;
        panel.style.transform = "";
        return;
      }

      const resisted = Math.min(dy * 0.92, window.innerHeight * 0.85);
      dragYRef.current = resisted;
      if (event.cancelable) event.preventDefault();
      panel.style.transform = `translate3d(0, ${resisted}px, 0)`;
    };

    const onTouchEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const dy = dragYRef.current;
      const fast = velocityRef.current > DISMISS_VELOCITY;
      if ((dy >= DISMISS_THRESHOLD_PX || fast) && onDismiss) {
        panel.style.transition = "transform 180ms ease-in";
        panel.style.transform = `translate3d(0, 110%, 0)`;
        onDismiss();
        return;
      }
      resetTransform();
    };

    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd);
    panel.addEventListener("touchcancel", onTouchEnd);

    return () => {
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", onTouchEnd);
      panel.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canDismiss, onDismiss, resetTransform]);

  return (
    <div
      ref={panelRef}
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "relative z-10 flex min-h-0 w-full flex-col overflow-hidden bg-card shadow-2xl will-change-transform",
        fullscreen
          ? "h-full max-h-none rounded-none border-0 bg-background"
          : cn(
              "max-h-[min(92%,40rem)] border border-border/80",
              "rounded-t-[1.35rem] sm:rounded-2xl",
              "pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:pb-0",
              maxWidth
            ),
        className
      )}
    >
      {!fullscreen && showHandle ? (
        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        </div>
      ) : null}
      {children}
    </div>
  );
}
