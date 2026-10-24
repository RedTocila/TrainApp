import type { Profile } from "@/lib/types";
import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
  PLATFORM_FREE_NAME,
  PLATFORM_PLUS_NAME,
  PLATFORM_PRO_NAME,
} from "@/lib/brand";
import {
  planIncludesAi,
  planIncludesElite,
  planIncludesPlus,
} from "@/lib/subscription-plans";

export type SubscriptionStatus =
  | "inactive"
  | "active"
  | "past_due"
  | "canceled";

export function isSubscriptionActive(
  profile: Pick<Profile, "role" | "subscription_status" | "subscription_expires_at">
): boolean {
  if (profile.role === "admin") return true;
  const status = profile.subscription_status;
  if (status !== "active" && status !== "canceled") {
    return false;
  }
  // Missing expiry must not grant permanent access (bad/legacy writes).
  if (!profile.subscription_expires_at) return false;
  return new Date(profile.subscription_expires_at) > new Date();
}

export function hasPaidAccess(
  profile: Pick<Profile, "role" | "subscription_status" | "subscription_expires_at">
): boolean {
  return isSubscriptionActive(profile);
}

/** Plus: AI builders, nutrition plans, multiple programs, weekly reports, advanced stats. */
export function hasPlusAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesPlus(profile.subscription_plan);
}

/** Pro coach: conversations, adjustments, detailed insights. Legacy AI Pro included. */
export function hasProAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesAi(profile.subscription_plan);
}

/** Premium AI coach features: conversations, adjustments, photo meals, detailed insights. */
export function hasAiAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesAi(profile.subscription_plan);
}

/** Pro community features: live classes and premium challenges. Legacy Elite included. */
export function hasEliteAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesElite(profile.subscription_plan);
}

export function subscriptionLabel(
  plan: Profile["subscription_plan"],
  interval: Profile["subscription_interval"]
): string {
  if (!plan || plan === "free") return PLATFORM_FREE_NAME;
  const planName =
    plan === "pro"
      ? PLATFORM_PRO_NAME
      : plan === "plus"
        ? PLATFORM_PLUS_NAME
        : plan === "elite"
          ? PLATFORM_ELITE_NAME
          : plan === "ai"
            ? PLATFORM_AI_PRO_NAME
            : plan === "basic"
              ? PLATFORM_BASIC_NAME
              : PLATFORM_CORE_NAME;
  if (!interval) return planName;
  const billing = interval === "annual" ? "Annual" : "Monthly";
  return `${planName} · ${billing}`;
}

export function addBillingPeriod(from: Date, interval: "monthly" | "annual"): Date {
  const next = new Date(from);
  if (interval === "annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
