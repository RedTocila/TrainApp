import type { Profile } from "@/lib/types";

/**
 * Native shell hides packages, checkout, and referral screens.
 * Accounts and payment happen on the website. Signing in does not grant Elite.
 *
 * This build does not sell App Store subscriptions, so account deletion does not
 * mention Apple billing. If this flag is turned off, tell the user before they
 * confirm deletion that Apple may keep billing, and offer Apple's subscription
 * management screen. The app cannot cancel Apple billing itself.
 */
export const NATIVE_APP_FREE = true;

/**
 * When true, the native app hides the challenges entry and blocks challenge routes.
 * Temporary for App Store review — turn this off when challenges go back in.
 * If challenges return, review their official rules, prizes, and Apple's
 * sponsorship disclaimer before the next submission.
 */
export const NATIVE_HIDE_CHALLENGES = true;

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
