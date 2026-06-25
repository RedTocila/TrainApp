import { PLATFORM_AI_NAME, PLATFORM_CORE_NAME } from "@/lib/brand";
import type { CheckoutCurrency, MultiCurrencyPrice } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";

export type SubscriptionPlanId = "core" | "ai";
export type BillingInterval = "monthly" | "annual";

export interface PlanPrice {
  amountCents: number;
  label: string;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  monthly: MultiCurrencyPrice;
  annual: MultiCurrencyPrice;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "core",
    name: PLATFORM_CORE_NAME,
    tagline: "Full training & nutrition tracking without premium AI tools.",
    monthly: {
      ALL: { amountCents: 100, label: "L1" },
      EUR: { amountCents: 100, label: "€1" },
    },
    annual: {
      ALL: { amountCents: 100, label: "L1" },
      EUR: { amountCents: 100, label: "€1" },
    },
    features: [
      "Workout builder & sessions",
      "Nutrition plans & manual meal logging",
      "Water, habits & cardio tracking",
      "Calendar & daily to-do sync",
      "Weight tracking & progress photos",
      "AI Coach insights, reports & recommendations",
    ],
  },
  {
    id: "ai",
    name: PLATFORM_AI_NAME,
    tagline: "Core plan plus AI plan builders, meal logging, and live coaching.",
    monthly: {
      ALL: { amountCents: 100, label: "L1" },
      EUR: { amountCents: 100, label: "€1" },
    },
    annual: {
      ALL: { amountCents: 100, label: "L1" },
      EUR: { amountCents: 100, label: "€1" },
    },
    highlighted: true,
    badge: "Best value",
    features: [
      `Everything in ${PLATFORM_CORE_NAME}`,
      "AI workout plan builder",
      "AI nutrition plan builder",
      "Photo & text AI meal logging",
      "Live coaching sessions + replays",
    ],
  },
];

export function getPlan(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

export function getPlanPrice(
  planId: SubscriptionPlanId,
  interval: BillingInterval,
  currency: CheckoutCurrency = "ALL"
): PlanPrice {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  return getCurrencyPrice(tier, currency);
}

export function planIncludesAi(planId: SubscriptionPlanId | null | undefined): boolean {
  return planId === "ai";
}
