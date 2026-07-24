"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { Button } from "@/components/ui/button";

export function CoachReadMeDialog({
  open,
  onClose,
  onAccept,
  title,
  points,
  gotItLabel,
  agreeLabel,
  required = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  title: string;
  points: readonly string[];
  gotItLabel: string;
  agreeLabel: string;
  required?: boolean;
  footer?: ReactNode;
}) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  if (!open) return null;

  const canProceed = !required || agreed;

  return (
    <AppOverlay open={open} onClose={onClose} closeOnBackdrop={!required}>
      <AppOverlayPanel
        maxWidth="max-w-md"
        aria-labelledby="coach-read-me-title"
        className="max-h-[min(92%,36rem)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-2 sm:pt-4">
          <h2 id="coach-read-me-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          data-scroll-lock-scrollable
        >
          <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {footer ? <div className="mt-4">{footer}</div> : null}
          {required && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
              />
              <span className="text-sm leading-snug text-foreground">{agreeLabel}</span>
            </label>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card px-5 py-4">
          <Button
            type="button"
            className="w-full"
            disabled={!canProceed}
            onClick={required ? onAccept : onClose}
          >
            {gotItLabel}
          </Button>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
