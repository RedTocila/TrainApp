"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  APP_DIALOG_Z_INDEX,
  AppOverlay,
  AppOverlayPanel,
} from "@/components/app-overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export { APP_DIALOG_Z_INDEX };

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
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-1 sm:pt-4">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-lg font-black leading-tight">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            !title && !description && "pt-2"
          )}
          data-scroll-lock-scrollable
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-border/60 px-5 py-3 sm:py-4">
            {footer}
          </div>
        ) : null}
      </AppOverlayPanel>
    </AppOverlay>
  );
}
