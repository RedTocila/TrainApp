import type { Profile } from "@/lib/types";
import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
} from "@/lib/brand";
import { planIncludesAi, planIncludesElite } from "@/lib/subscription-plans";

export type SubscriptionStatus =
  | "inactive"
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

/** Free trial of the second package (AI Pro). Does not include Elite. */
export const FREE_TRIAL_DAYS = 7;
export const FREE_TRIAL_PLAN_ID = "ai" as const;

export function addFreeTrialPeriod(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + FREE_TRIAL_DAYS);
  return next;
}

export function isSubscriptionActive(
  profile: Pick<Profile, "role" | "subscription_status" | "subscription_expires_at">
): boolean {
  if (profile.role === "admin") return true;
  const status = profile.subscription_status;
  if (status !== "active" && status !== "canceled" && status !== "trialing") {
    return false;
  }
  if (!profile.subscription_expires_at) return status === "active";
  return new Date(profile.subscription_expires_at) > new Date();
}

export function isOnFreeTrial(
  profile: Pick<Profile, "role" | "subscription_status" | "subscription_expires_at">
): boolean {
  if (profile.role === "admin") return false;
  return profile.subscription_status === "trialing" && isSubscriptionActive(profile);
}

/** Whole days left on an active free trial (0 if expired / not on trial). */
export function freeTrialDaysRemaining(
  profile: Pick<Profile, "subscription_status" | "subscription_expires_at">
): number | null {
  if (profile.subscription_status !== "trialing" || !profile.subscription_expires_at) {
    return null;
  }
  const ms = new Date(profile.subscription_expires_at).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function hasPaidAccess(
  profile: Pick<Profile, "role" | "subscription_status" | "subscription_expires_at">
): boolean {
  return isSubscriptionActive(profile);
}

/** Premium AI features: plan builders, photo/text meal logging, AI coach. */
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

/** Elite-only features: live classes, community challenges, group coaching. */
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
  interval: Profile["subscription_interval"],
  options?: { trial?: boolean; trialDaysLeft?: number | null }
): string {
  if (options?.trial) {
    const days = options.trialDaysLeft;
    if (days != null && days > 0) {
      return `${PLATFORM_AI_PRO_NAME} · Free trial · ${days}d left`;
    }
    return `${PLATFORM_AI_PRO_NAME} · Free trial`;
  }
  if (!plan) return "Free preview";
  const planName =
    plan === "elite"
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

export type FreeTrialGrant = {
  subscription_plan: typeof FREE_TRIAL_PLAN_ID;
  subscription_status: "trialing";
  subscription_interval: "monthly" | "annual";
  subscription_expires_at: string;
  trial_started_at: string;
};

export function buildFreeTrialGrant(
  from: Date = new Date(),
  interval: "monthly" | "annual" = "monthly"
): FreeTrialGrant {
  const started = from.toISOString();
  return {
    subscription_plan: FREE_TRIAL_PLAN_ID,
    subscription_status: "trialing",
    subscription_interval: interval,
    subscription_expires_at: addFreeTrialPeriod(from).toISOString(),
    trial_started_at: started,
  };
}

/** True when the user has never started an AI Pro card trial. */
export function isEligibleForAiProTrial(
  profile: Pick<Profile, "role" | "trial_started_at" | "subscription_status" | "subscription_expires_at">
): boolean {
  if (profile.role === "admin") return false;
  if (profile.trial_started_at) return false;
  return !isSubscriptionActive(profile);
}
