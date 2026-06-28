"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ClientErrorFallback } from "@/components/client-error-fallback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const staleClient =
    error.name === "UnrecognizedActionError" ||
    error.message.includes("UnrecognizedActionError");

  return (
    <ClientErrorFallback
      title="This section couldn't load"
      message={
        staleClient
          ? "The app was updated. Reload the page, then try logging your meal again."
          : "Something went wrong while loading this page. You can try again or go back."
      }
      onRetry={() => reset()}
      onBack={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/dashboard";
        }
      }}
      digest={error.digest}
    />
  );
}
