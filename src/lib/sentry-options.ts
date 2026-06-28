import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function isSentryEnabled() {
  return Boolean(dsn);
}

export function getBaseSentryOptions():
  | Pick<
      NodeOptions,
      | "dsn"
      | "enabled"
      | "environment"
      | "tracesSampleRate"
      | "enableLogs"
      | "initialScope"
    >
  | Pick<
      EdgeOptions,
      | "dsn"
      | "enabled"
      | "environment"
      | "tracesSampleRate"
      | "enableLogs"
      | "initialScope"
    >
  | Pick<
      BrowserOptions,
      | "dsn"
      | "enabled"
      | "environment"
      | "tracesSampleRate"
      | "enableLogs"
      | "initialScope"
    > {
  return {
    dsn,
    enabled: isSentryEnabled(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: true,
    initialScope: {
      tags: {
        app: "train-app",
        site: "rutina.al",
      },
    },
  };
}
