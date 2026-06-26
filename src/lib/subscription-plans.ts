import { PLATFORM_AI_NAME } from "@/lib/brand";
import type { CheckoutCurrency, PriceInEur } from "@/lib/checkout-i18n";
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
    monthly: { amountEurCents: 1900 },
    annual: { amountEurCents: 19_000 },
    highlighted: true,
    badge: "All-in-one",
    features: [
      "Workout builder & sessions",
      "Nutrition plans & meal logging",
      "AI Coach Alex — motivation, help & answers",
      "AI workout & nutrition plan builders",
      "Photo & text AI meal logging",
      "Live coaching sessions + replays",
      "Water, habits, cardio & progress tracking",
    ],
  },
];

export function getPlan(planId: string): SubscriptionPlan | undefined {
  if (planId !== "ai") return undefined;
  return SUBSCRIPTION_PLANS[0];
}

export function getPlanPrice(
  planId: SubscriptionPlanId,
  interval: BillingInterval,
  currency: CheckoutCurrency,
  allPerEur: number
): PlanPrice {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  return getCurrencyPrice(tier, currency, allPerEur);
}

export function planIncludesAi(planId: string | null | undefined): boolean {
  return planId === "ai";
}
