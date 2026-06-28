"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function ProgressPhotoAlexDialog({
  open,
  onClose,
  title,
  message,
  primaryLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  primaryLabel?: string;
}) {
  const platform = usePlatformCopy();
  const label = primaryLabel ?? platform.photos.retakePhoto;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-photo-alex-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 pr-4">
            <AiCoachAvatar size="xs" className="mt-0.5 h-9 w-9 shrink-0" />
            <div>
              <h2 id="progress-photo-alex-title" className="font-bold">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end px-5 py-4">
          <Button onClick={onClose}>{label}</Button>
        </div>
      </div>
    </div>
  );
}
