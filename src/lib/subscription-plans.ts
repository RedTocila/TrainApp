import { PLATFORM_AI_NAME } from "@/lib/brand";
import type { PriceInEur } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";

/** @deprecated Legacy subscribers only — no longer sold. */
export type LegacySubscriptionPlanId = "core";

export type SubscriptionPlanId = "ai";
export type BillingInterval = "monthly" | "annual";

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlanId = "ai";

export interface PlanPrice {
  amountCents: number;
  label: string;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  monthly: PriceInEur;
  annual: PriceInEur;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "ai",
    name: PLATFORM_AI_NAME,
    tagline:
      "Full training & nutrition tracking, AI coaching, plan builders, and live sessions.",
    monthly: { amountEurCents: 2000 },
    annual: { amountEurCents: 20_000 },
    highlighted: true,
    badge: "All-in-one",
    features: [
      "Workout builder & tracked sessions",
      "Personal exercise library & workout folders",
      "Nutrition plans & scheduled meals",
      "AI Coach Alex — motivation, help & answers",
      "AI workout plan builder",
      "AI nutrition plan builder",
      "Photo & text AI meal logging",
      "Live coaching sessions + replays",
      "Water, habits & cardio tracking",
      "Progress photos, weight & macro trends",
      "AI weekly reports & meal insights",
    ],
  },
];

export function getPlan(planId: string): SubscriptionPlan | undefined {
  if (planId !== "ai") return undefined;
  return SUBSCRIPTION_PLANS[0];
}

export function getPlanPrice(
  planId: SubscriptionPlanId,
  interval: BillingInterval
): PlanPrice {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  return getCurrencyPrice(tier);
}

export function planIncludesAi(planId: string | null | undefined): boolean {
  return planId === "ai";
}
