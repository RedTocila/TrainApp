"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  ariaLabel,
  maxWidth = "max-w-lg",
  className,
  zIndex = 50,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  maxWidth?: string;
  className?: string;
  zIndex?: number;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [fullPage, setFullPage] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setFullPage((prev) => (prev ? false : prev));
      return;
    }

    const measure = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const available = window.innerHeight - 32;
      const next = panel.scrollHeight > available;
      setFullPage((prev) => (prev === next ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

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

  const shell = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={ariaLabel}
      className={cn(
        "relative z-10 flex w-full flex-col border border-border bg-card shadow-2xl",
        fullPage
          ? "min-h-full max-h-none rounded-none"
          : cn("overflow-hidden rounded-2xl", maxWidth),
        className
      )}
    >
      {(title || description) && (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-lg font-black">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className={cn(!title && !description && "pt-4")}>{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>
      ) : null}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-background" style={{ zIndex }}>
        <button
          type="button"
          aria-label="Close"
          className="overlay-backdrop fixed inset-0"
          onClick={onClose}
        />
        <div className="relative z-10 flex min-h-full flex-col">{shell}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      {shell}
    </div>
  );
}
