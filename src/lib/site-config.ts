/** Canonical production origin (apex domain). */
export const CANONICAL_SITE_ORIGIN = "https://rutina.al";

export const CANONICAL_SITE_HOST = "rutina.al";

export const WWW_SITE_HOST = "www.rutina.al";

/** Legacy Vercel hosts that should 308 to the custom domain in production. */
export const LEGACY_VERCEL_HOSTS = [
  "train-app-three.vercel.app",
  "train-app-red-tocila-s-projects.vercel.app",
  "train-app-git-main-red-tocila-s-projects.vercel.app",
] as const;
