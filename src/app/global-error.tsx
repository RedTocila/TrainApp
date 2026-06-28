"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ClientErrorFallback } from "@/components/client-error-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const isServerError = Boolean(error.digest);
  const staleClient = error.name === "UnrecognizedActionError";

  return (
    <html lang="en">
      <body className="premium-gradient min-h-screen antialiased">
        <ClientErrorFallback
          title="This page couldn't load"
          message={
            isServerError
              ? "A server error occurred. Reload and try again."
              : staleClient
                ? "The app was updated. Reload the page and try again."
                : "Reload to try again, or go back to the dashboard."
          }
          onRetry={() => {
            if (staleClient || isServerError) {
              window.location.reload();
              return;
            }
            reset();
          }}
          onBack={() => {
            window.location.href = "/dashboard";
          }}
          digest={error.digest}
        />
      </body>
    </html>
  );
}
