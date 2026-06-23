import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/landing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/terms", "/privacy", "/contact", "/login", "/register"];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.6,
  }));
}
