import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
} from "@/lib/brand";
import type { PriceInEur } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";

/** @deprecated Legacy subscribers only — no longer sold. */
export type LegacySubscriptionPlanId = "core";

export type SubscriptionPlanId = "basic" | "ai" | "elite";
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
  /** When set, shows "Everything in {name}, plus:" above features */
  includesFrom?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    name: PLATFORM_BASIC_NAME,
    tagline:
      "Perfect for users who want structured workouts, nutrition plans, and progress tracking.",
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
  },
  {
    id: "ai",
    name: PLATFORM_AI_PRO_NAME,
    tagline:
      "Everything in Basic, plus your own AI fitness coach that adapts to your progress.",
    monthly: { amountEurCents: 2000 },
    annual: { amountEurCents: 20_000 },
    highlighted: true,
    badge: "Most Popular",
    includesFrom: PLATFORM_BASIC_NAME,
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

export function getPlan(planId: string): SubscriptionPlan | undefined {
  const plan = PLAN_BY_ID.get(planId as SubscriptionPlanId);
  if (plan) return plan;
  /** Legacy subscribers on deprecated Core plan. */
  if (planId === "core") {
    return {
      ...SUBSCRIPTION_PLANS[0],
      id: "basic",
      name: PLATFORM_CORE_NAME,
    };
  }
  return undefined;
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
  return planId === "ai" || planId === "elite";
}

export function planIncludesElite(planId: string | null | undefined): boolean {
  return planId === "elite";
}
