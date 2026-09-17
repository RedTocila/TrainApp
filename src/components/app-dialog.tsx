"use client";

import { useId, type ReactNode } from "react";
import {
  APP_DIALOG_Z_INDEX,
  AppOverlay,
  AppOverlayPanel,
} from "@/components/app-overlay";
import { cn } from "@/lib/utils";

export { APP_DIALOG_Z_INDEX };

/** Shared drawer title row — no close X; swipe handle / backdrop dismiss instead. */
export function AppDrawerHeader({
  title,
  description,
  titleId,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  if (!title && !description) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 px-5 pb-1 pt-1 sm:pt-4",
        className
      )}
    >
      {title ? (
        <h2 id={titleId} className="text-lg font-black leading-tight">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="text-sm leading-snug text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  ariaLabel,
  maxWidth = "max-w-lg",
  className,
  zIndex = APP_DIALOG_Z_INDEX,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  maxWidth?: string;
  className?: string;
  zIndex?: number;
  closeOnBackdrop?: boolean;
}) {
  const titleId = useId();

  return (
    <AppOverlay
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      closeOnBackdrop={closeOnBackdrop}
    >
      <AppOverlayPanel
        maxWidth={maxWidth}
        aria-labelledby={title ? titleId : undefined}
        aria-label={ariaLabel}
        className={className}
      >
        <AppDrawerHeader
          title={title}
          description={description}
          titleId={title ? titleId : undefined}
        />

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            title || description ? "pt-5" : "pt-4"
          )}
          data-scroll-lock-scrollable
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 px-5 py-3 sm:py-4">
            {footer}
          </div>
        ) : null}
      </AppOverlayPanel>
    </AppOverlay>
  );
}
