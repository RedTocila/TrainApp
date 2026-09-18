"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
/** Keep in sync with `--duration-drawer` in globals.css */
const DRAWER_MS = 320;

type OverlayMotionContextValue = {
  /** True after open paint so CSS transitions can run closed → open. */
  entered: boolean;
};

const OverlayDismissContext = createContext<{
  onDismiss: (() => void) | null;
}>({ onDismiss: null });

const OverlayMotionContext = createContext<OverlayMotionContextValue>({
  entered: false,
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
  /**
   * `sheet` — bottom drawer on mobile, centered card on sm+.
   * `center` — content centered over blur (picker tiles, no panel chrome).
   */
  presentation = "sheet",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  fullscreen?: boolean;
  closeOnBackdrop?: boolean;
  presentation?: "sheet" | "center";
  className?: string;
}) {
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(false);
  const openRef = useRef(open);
  const centered = presentation === "center";

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timeoutId = 0;

    if (open) {
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
      }, DRAWER_MS);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useLockBodyScroll(present);
  const frame = useVisualViewportFrame(present);

  useEffect(() => {
    if (!present || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnBackdrop) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [present, open, onClose, closeOnBackdrop]);

  const dismissValue = useMemo(
    () => ({
      onDismiss: closeOnBackdrop && open ? onClose : null,
    }),
    [closeOnBackdrop, onClose, open]
  );

  const motionValue = useMemo(() => ({ entered }), [entered]);

  return (
    <DialogPortal open={present}>
      <OverlayDismissContext.Provider value={dismissValue}>
        <OverlayMotionContext.Provider value={motionValue}>
          <div
            className={cn(
              "fixed inset-x-0 flex justify-center",
              fullscreen
                ? "flex-col"
                : centered
                  ? "items-center p-5"
                  : "items-end sm:items-center sm:p-4",
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
                data-open={entered ? "true" : "false"}
                className={cn(
                  "overlay-backdrop absolute inset-0",
                  centered ? "backdrop-blur-md" : "backdrop-blur-sm"
                )}
                onClick={closeOnBackdrop && open ? onClose : undefined}
                disabled={!closeOnBackdrop || !open}
              />
            ) : null}
            {centered ? (
              <div
                data-open={entered ? "true" : "false"}
                className="overlay-center relative z-10 w-full"
              >
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </OverlayMotionContext.Provider>
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
  const { entered } = useContext(OverlayMotionContext);
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
      const target = event.target instanceof Element ? event.target : null;
      const fromHandle = Boolean(target?.closest("[data-drawer-handle]"));
      const scrollable = getScrollableAncestor(event.target, panel);
      if (!fromHandle && scrollable && scrollable.scrollTop > 2) {
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
        panel.dataset.dragDismissed = "true";
        panel.style.transition = "transform 200ms ease-in";
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

  useEffect(() => {
    if (!entered) return;
    const panel = panelRef.current;
    if (!panel) return;
    delete panel.dataset.dragDismissed;
    panel.style.transform = "";
    panel.style.transition = "";
  }, [entered]);

  return (
    <div
      ref={panelRef}
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-open={entered ? "true" : "false"}
      className={cn(
        "relative z-10 flex min-h-0 w-full flex-col overflow-hidden bg-card shadow-2xl will-change-transform",
        fullscreen
          ? "overlay-fullscreen h-full max-h-none rounded-none border-0 bg-background"
          : cn(
              "overlay-sheet max-h-[min(92%,40rem)] border border-border/80",
              "rounded-t-[1.35rem] sm:rounded-2xl",
              "pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:pb-0",
              maxWidth
            ),
        className
      )}
    >
      {!fullscreen && showHandle ? (
        <div
          data-drawer-handle
          className="flex shrink-0 cursor-grab justify-center py-2 active:cursor-grabbing sm:hidden"
          aria-hidden
        >
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
        </div>
      ) : null}
      {children}
    </div>
  );
}
