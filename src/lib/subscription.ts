import type { Profile } from "@/lib/types";
import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
} from "@/lib/brand";
import { planIncludesAi, planIncludesElite } from "@/lib/subscription-plans";

export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

export function isSubscriptionActive(profile: Pick<
  Profile,
  "role" | "subscription_status" | "subscription_expires_at"
>): boolean {
  if (profile.role === "admin") return true;
  const status = profile.subscription_status;
  if (status !== "active" && status !== "canceled") return false;
  if (!profile.subscription_expires_at) return status === "active";
  return new Date(profile.subscription_expires_at) > new Date();
}

export function hasPaidAccess(profile: Pick<
  Profile,
  "role" | "subscription_status" | "subscription_expires_at"
>): boolean {
  return isSubscriptionActive(profile);
}

/** Premium AI features: plan builders, photo/text meal logging, AI coach. */
export function hasAiAccess(profile: Pick<
  Profile,
  "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
>): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesAi(profile.subscription_plan);
}

/** Elite-only features: live classes, community challenges, group coaching. */
export function hasEliteAccess(profile: Pick<
  Profile,
  "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
>): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return planIncludesElite(profile.subscription_plan);
}

export function subscriptionLabel(
  plan: Profile["subscription_plan"],
  interval: Profile["subscription_interval"]
): string {
  if (!plan) return "Free preview";
  const planName =
    plan === "elite"
      ? PLATFORM_ELITE_NAME
      : plan === "ai"
        ? PLATFORM_AI_PRO_NAME
        : plan === "basic"
          ? PLATFORM_BASIC_NAME
          : PLATFORM_CORE_NAME;
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
