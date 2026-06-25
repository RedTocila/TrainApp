"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, isPending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={isPending ? undefined : onClose}
        disabled={isPending}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sarcastic-give-up-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 pr-4">
            <AiCoachAvatar size="xs" className="mt-0.5 h-9 w-9 shrink-0" />
            <div>
              <h2 id="sarcastic-give-up-title" className="font-bold">
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
            disabled={isPending}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
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
      </div>
    </div>
  );
}
