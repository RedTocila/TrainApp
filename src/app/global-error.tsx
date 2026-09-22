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
    console.error("[GlobalError]", error.name, error.message, error.digest);
    Sentry.captureException(error);
  }, [error]);

  const staleClient =
    error.name === "UnrecognizedActionError" ||
    error.message.includes("UnrecognizedActionError");

  return (
    <html lang="en">
      <body className="premium-gradient min-h-screen antialiased">
        <ClientErrorFallback
          title="Couldn't open this page"
          message={
            staleClient
              ? "The app was updated. Reload the page and try again."
              : "Something went wrong. Reload to try again, or go back home."
          }
          onRetry={() => {
            if (staleClient || error.digest) {
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
