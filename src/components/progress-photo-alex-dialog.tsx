"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-md" aria-labelledby="progress-photo-alex-title">
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
        </AppOverlayPanel>
    </AppOverlay>
  );
}
