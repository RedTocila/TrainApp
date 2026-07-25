import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";

function trimUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function firstNonLocalhostUrl(candidates: Array<string | undefined>): string | null {
  for (const value of candidates) {
    if (value && !isLocalhostUrl(value)) {
      return trimUrl(value);
    }
  }
  return null;
}

/**
 * Canonical app origin for server-side redirects and webhooks.
 * Never returns localhost when running on Vercel.
 */
export function getAppBaseUrl(): string {
  if (process.env.APP_URL) {
    const appUrl = trimUrl(process.env.APP_URL);
    if (!(process.env.VERCEL === "1" && isLocalhostUrl(appUrl))) {
      return appUrl;
    }
  }

  const onVercel = process.env.VERCEL === "1";

  if (onVercel) {
    if (
      process.env.VERCEL_ENV === "production" &&
      process.env.VERCEL_PROJECT_PRODUCTION_URL
    ) {
      return `https://${trimUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
    }

    if (process.env.VERCEL_URL) {
      return `https://${trimUrl(process.env.VERCEL_URL)}`;
    }
  }

  for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const value = process.env[key];
    if (value && !(onVercel && isLocalhostUrl(value))) {
      return trimUrl(value);
    }
  }

  return "http://localhost:3000";
}

/**
 * Base URL for auth emails (confirm / magic links).
 * Never embeds localhost — phones cannot open those links.
 */
export function getAuthEmailRedirectBaseUrl(): string {
  return (
    firstNonLocalhostUrl([
      process.env.APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ]) ?? CANONICAL_SITE_ORIGIN
  );
}

/** Full redirect target embedded in Supabase auth emails. */
export function getAuthEmailRedirectUrl(
  path = "/auth/callback",
  next = "/dashboard/pricing?onboarding=1"
): string {
  const base = getAuthEmailRedirectBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams({ next });
  return `${base}${normalizedPath}?${params.toString()}`;
}

export function getCanonicalSiteOrigin(): string {
  return CANONICAL_SITE_ORIGIN;
}
