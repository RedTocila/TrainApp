import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
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
