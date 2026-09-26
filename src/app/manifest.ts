import type { MetadataRoute } from "next";

import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`,
    short_name: PLATFORM_NAME,
    description:
      "Platforma jote e personalizuar për stërvitje, ushqim dhe coaching — me coach AI dhe sesione live.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
