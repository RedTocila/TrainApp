/** Native-app-only routes. Web marketing/dashboard flows must not link here. */
export const IOS_WELCOME_PATH = "/ios/welcome";
export const IOS_ONBOARDING_PATH = "/ios/onboarding";
export const IOS_GENERATING_PATH = "/ios/generating";

export const IOS_STORAGE_KEYS = {
  /** Marks that the user has started the native onboarding funnel. */
  onboardingStarted: "rutina-ios-onboarding-started",
} as const;

export function isIosAppPath(pathname: string): boolean {
  return pathname === "/ios" || pathname.startsWith("/ios/");
}

/** Allowed post-auth redirects from native account screens. */
export function safeNativeRedirect(next: unknown): string | null {
  if (typeof next !== "string") return null;
  const path = next.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (isIosAppPath(path)) return path;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return path;
  return null;
}
