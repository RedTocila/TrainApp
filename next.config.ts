import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "static.exercisedb.dev",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "cdn.exercisedb.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.exercisedb.dev",
        pathname: "/media/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Meal photo analysis sends compressed base64; keep headroom above default 1 MB.
      bodySizeLimit: "3mb",
    },
    // Dynamic pages default to 0s, so a route you just left is fetched again.
    // Keep it for a few minutes. Saves still call revalidatePath / router.refresh,
    // which drop this cache.
    staleTimes: {
      dynamic: 300,
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "redtocila",
  project: process.env.SENTRY_PROJECT ?? "rutina",
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
});
