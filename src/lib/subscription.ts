import type { Profile } from "@/lib/types";
import type { SubscriptionPlanId } from "@/lib/subscription-plans";

export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

export function isSubscriptionActive(profile: Pick<
  Profile,
  "role" | "subscription_status" | "subscription_expires_at"
>): boolean {
  if (profile.role === "admin") return true;
  if (profile.subscription_status !== "active") return false;
  if (!profile.subscription_expires_at) return true;
  return new Date(profile.subscription_expires_at) > new Date();
}

export function hasPaidAccess(profile: Pick<
  Profile,
  "role" | "subscription_status" | "subscription_expires_at"
>): boolean {
  return isSubscriptionActive(profile);
}

export function hasAiAccess(profile: Pick<
  Profile,
  "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
>): boolean {
  if (profile.role === "admin") return true;
  if (!isSubscriptionActive(profile)) return false;
  return profile.subscription_plan === "ai";
}

export function subscriptionLabel(
  plan: SubscriptionPlanId | null | undefined,
  interval: Profile["subscription_interval"]
): string {
  if (!plan) return "Free preview";
  const planName = plan === "ai" ? "TrainApp AI" : "TrainApp Core";
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
