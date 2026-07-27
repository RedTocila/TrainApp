import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
} from "@/lib/brand";
import type { PriceInEur } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";

/** @deprecated Legacy subscribers only — no longer sold. */
export type LegacySubscriptionPlanId = "core" | "basic";

/** Plans available for new purchases. */
export type SoldSubscriptionPlanId = "ai" | "elite";

export type SubscriptionPlanId = SoldSubscriptionPlanId | "basic";
export type BillingInterval = "monthly" | "annual";

export const DEFAULT_SUBSCRIPTION_PLAN: SoldSubscriptionPlanId = "ai";

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
  /** When set, shows "Everything in {name}, plus:" above features */
  includesFrom?: string;
}

/** Sold plans only — free manual tracking is included with every account. */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "ai",
    name: PLATFORM_AI_PRO_NAME,
    tagline:
      "Everything in free manual tracking, plus your own AI fitness coach. Start free for 3 days with a card — cancel anytime.",
    monthly: { amountEurCents: 2000 },
    annual: { amountEurCents: 20_000 },
    highlighted: true,
    badge: "3-day free trial",
    includesFrom: "Free",
    features: [
      "AI Fitness Coach",
      "AI Nutrition Coach",
      "AI Workout Generator",
      "AI Meal Suggestions",
      "AI Progress Reports",
      "AI Daily Motivation",
      "AI Fitness Chat",
      "Personalized recommendations",
      "Automatic workout adjustments",
      "Automatic calorie and macro recommendations",
      "AI recovery and performance insights",
    ],
  },
  {
    id: "elite",
    name: PLATFORM_ELITE_NAME,
    tagline:
      "The complete fitness experience with coaching, community, and live events.",
    monthly: { amountEurCents: 3000 },
    annual: { amountEurCents: 30_000 },
    includesFrom: PLATFORM_AI_PRO_NAME,
    features: [
      "Live training classes",
      "Community challenges",
      "Monthly transformation challenges",
      "Cash prize competitions (prize pool depends on participation)",
      "Weekly group coaching calls",
      "Leaderboards",
      "Exclusive workouts",
      "Exclusive educational content",
      "Early access to new features",
      "Priority support",
      "Elite community access",
    ],
  },
];

const PLAN_BY_ID = new Map(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan]));

/** Legacy Basic plan — kept for existing subscribers / labels only. */
const LEGACY_BASIC_PLAN: SubscriptionPlan = {
  id: "basic",
  name: PLATFORM_BASIC_NAME,
  tagline:
    "Structured workouts, nutrition plans, and progress tracking (legacy plan).",
  monthly: { amountEurCents: 500 },
  annual: { amountEurCents: 5000 },
  features: [
    "Personalized workout plans",
    "Nutrition plans",
    "Manual meal logging",
    "Weight tracking",
    "Body measurements",
    "Progress photos",
    "Workout history",
    "Progress statistics",
    "Daily streak tracking",
    "Basic achievements",
    "Exercise library",
    "Unlimited workout logging",
  ],
};

export function getPlan(planId: string): SubscriptionPlan | undefined {
  const plan = PLAN_BY_ID.get(planId as SubscriptionPlanId);
  if (plan) return plan;
  if (planId === "basic") return LEGACY_BASIC_PLAN;
  /** Legacy Core remaps to Basic-like features for display. */
  if (planId === "core") {
    return { ...LEGACY_BASIC_PLAN, name: PLATFORM_CORE_NAME };
  }
  return undefined;
}

export function getPlanPrice(
  planId: SubscriptionPlanId | "core",
  interval: BillingInterval
): PlanPrice {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  return getCurrencyPrice(tier);
}

export function isSoldPlanId(planId: string): planId is SoldSubscriptionPlanId {
  return planId === "ai" || planId === "elite";
}

export function planIncludesAi(planId: string | null | undefined): boolean {
  return planId === "ai" || planId === "elite";
}

export function planIncludesElite(planId: string | null | undefined): boolean {
  return planId === "elite";
}
