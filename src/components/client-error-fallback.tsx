"use client";

import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientErrorFallback({
  title = "Something went wrong",
  message = "Please try again. If this keeps happening, reload the page.",
  onRetry,
  onBack,
  digest,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  /** Support code only — never show raw exception text to users. */
  digest?: string;
}) {
  return (
    <div className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center px-4 py-12 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80"
        aria-hidden
      >
        <span className="text-2xl font-black text-muted-foreground/70">?</span>
      </div>
      <h2 className="mt-5 text-xl font-black tracking-tight">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      <div className="mt-7 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
        {onRetry ? (
          <Button type="button" className="gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        ) : null}
        {onBack ? (
          <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
            <Home className="h-4 w-4" aria-hidden />
            Back
          </Button>
        ) : null}
      </div>
      {digest ? (
        <p className="mt-6 text-[10px] tabular-nums text-muted-foreground/50">
          Ref {digest.slice(0, 12)}
        </p>
      ) : null}
    </div>
  );
}
