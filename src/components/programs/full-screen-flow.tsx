"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FullScreenFlow({
  open,
  onClose,
  title,
  subtitle,
  children,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  contentClassName?: string;
}) {
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
    <div
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="mobile-top-safe flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          {subtitle && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {subtitle}
            </p>
          )}
          <h2 className="truncate text-lg font-black">{title}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </header>
      <main
        className={cn(
          "flex-1 overflow-y-auto px-4 py-4 sm:px-6",
          contentClassName
        )}
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
