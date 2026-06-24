import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  experimental: {
    serverActions: {
      // Meal photo analysis sends compressed base64; keep headroom above default 1 MB.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
