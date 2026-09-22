"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ClientErrorFallback } from "@/components/client-error-fallback";

function userFacingMessage(error: Error & { digest?: string }) {
  const staleClient =
    error.name === "UnrecognizedActionError" ||
    error.message.includes("UnrecognizedActionError");
  if (staleClient) {
    return "The app was updated. Reload the page, then try again.";
  }
  return "Something went wrong on this page. Try again, or head back and continue from there.";
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error.name, error.message, error.digest);
    Sentry.captureException(error);
  }, [error]);

  const staleClient =
    error.name === "UnrecognizedActionError" ||
    error.message.includes("UnrecognizedActionError");

  return (
    <ClientErrorFallback
      title="Couldn't open this page"
      message={userFacingMessage(error)}
      onRetry={() => {
        if (staleClient) {
          window.location.reload();
          return;
        }
        reset();
      }}
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
