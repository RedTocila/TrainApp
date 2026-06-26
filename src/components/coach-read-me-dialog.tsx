"use client";

import { useEffect, useState } from "react";
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
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  title: string;
  points: readonly string[];
  gotItLabel: string;
  agreeLabel: string;
  required?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  useEffect(() => {
    if (!open || required) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, required]);

  if (!open) return null;

  const canProceed = !required || agreed;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="coach-read-me-title" className="text-lg font-bold">
            {title}
          </h2>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
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
        <Button
          type="button"
          className={cn("w-full", required ? "mt-3" : "mt-5")}
          disabled={!canProceed}
          onClick={required ? onAccept : onClose}
        >
          {gotItLabel}
        </Button>
      </div>
    </div>
  );
}
