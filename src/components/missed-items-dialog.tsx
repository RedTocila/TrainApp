"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MissedItem {
  id: string;
  label: string;
  detail?: string;
}

export function MissedButton({
  count,
  title,
  items,
  hint,
  className,
  tone = "missed",
  buttonLabel,
}: {
  count: number;
  title: string;
  items: MissedItem[];
  hint?: string;
  className?: string;
  tone?: "missed" | "warning";
  buttonLabel?: string;
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  if (count <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase leading-snug tracking-wide transition-colors",
          tone === "warning"
            ? "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/20"
            : "border-red-500/40 bg-red-500/10 text-red-400 hover:border-red-500/60 hover:bg-red-500/20",
          className
        )}
      >
        {buttonLabel ?? platform.common.skipped(count)}
      </button>
      <MissedItemsDialog
        open={open}
        title={title}
        items={items}
        hint={hint}
        tone={tone}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function MissedItemsDialog({
  open,
  title,
  items,
  hint,
  tone = "missed",
  onClose,
}: {
  open: boolean;
  title: string;
  items: MissedItem[];
  hint?: string;
  tone?: "missed" | "warning";
  onClose: () => void;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[min(85vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2
              className={cn(
                "text-lg font-black",
                tone === "warning" ? "text-orange-400" : "text-red-400"
              )}
            >
              {title}
            </h2>
            {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={platform.aria.close}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {coachLabels.nothingMissed}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    tone === "warning"
                      ? "border-orange-500/30 bg-orange-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      tone === "warning" ? "text-orange-400" : "text-red-400"
                    )}
                  >
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {coachLabels.illDoBetter}
          </Button>
        </div>
      </div>
    </div>
  );
}
