"use client";

import { useEffect, type ReactNode } from "react";
import { DialogPortal } from "@/components/dialog-portal";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useVisualViewportFrame } from "@/hooks/use-visual-viewport-frame";
import { cn } from "@/lib/utils";

/** Above dashboard mobile nav (z-100) and common chrome. */
export const APP_DIALOG_Z_INDEX = 120;

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

  return (
    <DialogPortal open={open}>
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
    </DialogPortal>
  );
}

/**
 * Panel surface for AppOverlay: bottom sheet on mobile, centered card on sm+.
 */
export function AppOverlayPanel({
  children,
  className,
  maxWidth = "max-w-lg",
  fullscreen = false,
  showHandle = true,
  role = "dialog",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
  fullscreen?: boolean;
  showHandle?: boolean;
  role?: "dialog" | "alertdialog";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <div
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "relative z-10 flex min-h-0 w-full flex-col overflow-hidden bg-card shadow-2xl",
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
