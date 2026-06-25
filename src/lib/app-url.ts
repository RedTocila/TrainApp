function trimUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Canonical app origin for server-side redirects and webhooks.
 * Never returns localhost when running on Vercel.
 */
export function getAppBaseUrl(): string {
  if (process.env.APP_URL) {
    return trimUrl(process.env.APP_URL);
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
