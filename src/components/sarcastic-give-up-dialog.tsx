"use client";

import { useEffect } from "react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useCoachCopy, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function SarcasticGiveUpDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isPending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
}) {
  const platform = usePlatformCopy();
  const coachCopy = useCoachCopy();
  const resolvedConfirm = confirmLabel ?? coachCopy.giveUpTrainerPlan.confirm;
  const resolvedCancel = cancelLabel ?? platform.common.cancel;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isPending]);

  if (!open) return null;

  return (
    <AppOverlay open={open} onClose={onClose} closeOnBackdrop={!isPending}>
      <AppOverlayPanel maxWidth="max-w-md" aria-labelledby="sarcastic-give-up-title">
        <div className="flex shrink-0 items-start gap-3 px-5 pb-3.5 pt-1 sm:pt-4">
          <AiCoachAvatar size="xs" className="mt-0.5 h-9 w-9 shrink-0" />
          <div>
            <h2 id="sarcastic-give-up-title" className="text-lg font-black leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 pt-5 pb-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {resolvedCancel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-500/90 hover:bg-red-500"
          >
            {isPending ? platform.common.surrendering : resolvedConfirm}
          </Button>
        </div>
      </AppOverlayPanel>
      </AppOverlay>
  );
}
