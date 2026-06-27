"use client";

import { AlertTriangle } from "lucide-react";
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
  digest?: string;
}) {
  return (
    <div className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
        <AlertTriangle className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        )}
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      {digest && (
        <p className="mt-4 text-xs text-muted-foreground">Error {digest}</p>
      )}
    </div>
  );
}
