import type { Profile } from "@/lib/types";

/**
 * Native app (iOS/Android shell) is free: no packages or paywalls, and every
 * signed-in client is granted Elite while using the app. The website keeps paid plans.
 */
export const NATIVE_APP_FREE = true;

/** When true, the native app hides the challenges entry and blocks challenge routes. */
export const NATIVE_HIDE_CHALLENGES = false;

/**
 * Sentinel expiry written for free-app Elite grants. Paid subscriptions always carry a
 * billing interval and a real renewal date, so this value identifies app grants in SQL.
 */
export const APP_FREE_ACCESS_EXPIRES_AT = "2099-12-31T23:59:59.000Z";

export function isAppFreeAccessGrant(
  profile: Pick<Profile, "subscription_expires_at" | "subscription_interval">
): boolean {
  if (profile.subscription_interval) return false;
  if (!profile.subscription_expires_at) return false;
  return (
    new Date(profile.subscription_expires_at).getTime() ===
    new Date(APP_FREE_ACCESS_EXPIRES_AT).getTime()
  );
}
