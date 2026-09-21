"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useState } from "react";
import { AppDrawerHeader } from "@/components/app-dialog";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
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
            ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/20"
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

  if (!open) return null;

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-md" aria-label={title} className="max-h-[min(92%,28rem)]">
        <AppDrawerHeader
          title={
            <span className={tone === "warning" ? "text-amber-400" : "text-red-400"}>
              {title}
            </span>
          }
          description={hint}
        />

        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
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
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      tone === "warning" ? "text-amber-400" : "text-red-400"
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

        <div className="px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {coachLabels.illDoBetter}
          </Button>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
