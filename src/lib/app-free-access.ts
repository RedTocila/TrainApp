import type { Profile } from "@/lib/types";

/**
 * iPhone sells Plus and Pro with App Store billing. The website keeps card checkout.
 * Signing in still honors a plan already bought on either side.
 */
export const NATIVE_APP_FREE = false;

/**
 * Challenges and live classes are Pro features. The app shows them and the
 * server checks the subscription. Payment still happens on the website.
 */
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
