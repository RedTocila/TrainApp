import { PLATFORM_AI_NAME, PLATFORM_CORE_NAME } from "@/lib/brand";

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
  monthly: PlanPrice;
  annual: PlanPrice;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "core",
    name: PLATFORM_CORE_NAME,
    tagline: "Full training & nutrition tracking without premium AI tools.",
    monthly: { amountCents: 700, label: "€7" },
    annual: { amountCents: 6900, label: "€69" },
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
    monthly: { amountCents: 1900, label: "€19" },
    annual: { amountCents: 18900, label: "€189" },
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
  interval: BillingInterval
): PlanPrice {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  return interval === "monthly" ? plan.monthly : plan.annual;
}

export function planIncludesAi(planId: SubscriptionPlanId | null | undefined): boolean {
  return planId === "ai";
}
