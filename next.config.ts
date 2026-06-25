import type { NextConfig } from "next";

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
    ],
  },
  experimental: {
    serverActions: {
      // Meal photo analysis sends compressed base64; keep headroom above default 1 MB.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
