"use client";

import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [mounted, setMounted] = useState(false);

  useLockBodyScroll(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const canProceed = !required || agreed;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center px-4",
        // Keep the sheet in the visible band above the mobile bottom nav
        "py-4 pb-[calc(var(--dashboard-mobile-nav-height,4.25rem)+0.75rem)]",
        "lg:pb-4"
      )}
    >
      {!required && (
        <button
          type="button"
          aria-label="Close"
          className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {required && (
        <div className="overlay-backdrop absolute inset-0 backdrop-blur-sm" aria-hidden />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-read-me-title"
        className="relative z-10 flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
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
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
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
      </div>
    </div>,
    document.body
  );
}
