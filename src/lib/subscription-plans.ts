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
    name: "TrainApp Core",
    tagline: "Everything you need to track training and nutrition.",
    monthly: { amountCents: 900, label: "€9" },
    annual: { amountCents: 8900, label: "€89" },
    features: [
      "Workout builder & sessions",
      "Nutrition plans & meal logging",
      "Water, habits & cardio tracking",
      "Calendar & daily to-do sync",
      "Weight tracking & progress",
    ],
  },
  {
    id: "ai",
    name: "TrainApp AI",
    tagline: "Core plan plus your AI-powered fitness & nutrition coach.",
    monthly: { amountCents: 2400, label: "€24" },
    annual: { amountCents: 22900, label: "€229" },
    highlighted: true,
    badge: "Best value",
    features: [
      "Everything in TrainApp Core",
      "Photo & text AI meal logging",
      "Smart meal suggestions & macro coaching",
      "Progress predictions & weekly AI reports",
      "Habit pattern detection & recommendations",
      "Live coaching classes + replays",
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
