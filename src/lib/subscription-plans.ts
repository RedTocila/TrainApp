import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_CORE_NAME,
  PLATFORM_ELITE_NAME,
  PLATFORM_FREE_NAME,
  PLATFORM_PLUS_NAME,
  PLATFORM_PRO_NAME,
} from "@/lib/brand";
import type { PriceInEur } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";

/** @deprecated Legacy subscribers only — no longer sold. */
export type LegacySubscriptionPlanId = "core" | "basic" | "ai" | "elite";

/** Plans available for new purchases. Free is a €0 account, not a checkout plan. */
export type SoldSubscriptionPlanId = "plus" | "pro";

export type SubscriptionPlanId = "free" | SoldSubscriptionPlanId | LegacySubscriptionPlanId;
export type BillingInterval = "monthly" | "annual";

export const DEFAULT_SUBSCRIPTION_PLAN: SoldSubscriptionPlanId = "plus";

/** Free accounts may keep one saved workout or nutrition program. Plus and Pro are unlimited. */
export const FREE_SAVED_PROGRAM_LIMIT = 1;

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
  /** Free is usable without checkout. */
  purchasable?: boolean;
}

/** Shown on pricing. Free is not charged. Plus and Pro are sold on the website. */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: PLATFORM_FREE_NAME,
    tagline: "Train, log, and track with no payment details.",
    monthly: { amountEurCents: 0 },
    annual: { amountEurCents: 0 },
    purchasable: false,
    features: [
      "Calendar",
      "Habit tracking",
      "Manual workout logging",
      "Exercise library",
      "Water and food logging",
      "Basic progress tracking",
    ],
  },
  {
    id: "plus",
    name: PLATFORM_PLUS_NAME,
    tagline: "AI plans, saved programs, and a clearer look at your week.",
    monthly: { amountEurCents: 700 },
    annual: { amountEurCents: 7000 },
    includesFrom: PLATFORM_FREE_NAME,
    features: [
      "AI workout builder",
      "Personalized nutrition plans",
      "Multiple saved programs",
      "Weekly reports",
      "Advanced statistics",
    ],
  },
  {
    id: "pro",
    name: PLATFORM_PRO_NAME,
    tagline: "A coach that adjusts the plan, plus live training when it's on.",
    monthly: { amountEurCents: 2500 },
    annual: { amountEurCents: 25_000 },
    highlighted: true,
    badge: "Full access",
    includesFrom: PLATFORM_PLUS_NAME,
    features: [
      "Advanced AI Coach conversations",
      "Personalized workout and nutrition adjustments",
      "Detailed progress insights",
      "Premium challenges and live classes where available",
    ],
  },
];

const PLAN_BY_ID = new Map(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan]));

/** Legacy AI Pro — kept for existing subscribers / labels only. */
const LEGACY_AI_PLAN: SubscriptionPlan = {
  id: "ai",
  name: PLATFORM_AI_PRO_NAME,
  tagline: "Your own AI fitness coach for workouts, nutrition, and progress (legacy plan).",
  monthly: { amountEurCents: 2000, compareAtEurCents: 4900 },
  annual: { amountEurCents: 20_000, compareAtEurCents: 49_000 },
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
};

/** Legacy Basic plan — kept for existing subscribers / labels only. */
const LEGACY_BASIC_PLAN: SubscriptionPlan = {
  id: "basic",
  name: PLATFORM_BASIC_NAME,
  tagline: "Structured workouts, nutrition plans, and progress tracking (legacy plan).",
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

const LEGACY_ELITE_PLAN: SubscriptionPlan = {
  id: "elite",
  name: PLATFORM_ELITE_NAME,
  tagline: "Legacy full membership. New memberships are Pro.",
  monthly: { amountEurCents: 2999 },
  annual: { amountEurCents: 29_990 },
  features: [
    "Everything in Pro",
    "Live training classes",
    "Community challenges",
  ],
};

export function getPlan(planId: string): SubscriptionPlan | undefined {
  const plan = PLAN_BY_ID.get(planId as SubscriptionPlanId);
  if (plan) return plan;
  if (planId === "ai") return LEGACY_AI_PLAN;
  if (planId === "basic") return LEGACY_BASIC_PLAN;
  if (planId === "elite") return LEGACY_ELITE_PLAN;
  /** Legacy Core remaps to Basic-like features for display. */
  if (planId === "core") {
    return { ...LEGACY_BASIC_PLAN, id: "core", name: PLATFORM_CORE_NAME };
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
  return planId === "plus" || planId === "pro";
}

export function isPurchasablePlan(plan: SubscriptionPlan): boolean {
  return plan.purchasable !== false && isSoldPlanId(plan.id);
}

/** Plus features: builders, nutrition plans, multiple programs, reports, advanced stats. */
export function planIncludesPlus(planId: string | null | undefined): boolean {
  return (
    planId === "plus" ||
    planId === "pro" ||
    planId === "basic" ||
    planId === "core" ||
    planId === "ai" ||
    planId === "elite"
  );
}

/** Pro coach: conversations, adjustments, detailed insights. Legacy AI Pro keeps this. */
export function planIncludesPro(planId: string | null | undefined): boolean {
  return planId === "pro" || planId === "ai" || planId === "elite";
}

/** Live classes and premium challenges. Legacy Elite keeps this. */
export function planIncludesCommunity(planId: string | null | undefined): boolean {
  return planId === "pro" || planId === "elite";
}

/** @deprecated Use planIncludesPro. Kept so existing call sites stay stable. */
export function planIncludesAi(planId: string | null | undefined): boolean {
  return planIncludesPro(planId);
}

/** @deprecated Use planIncludesCommunity. Pro replaces Elite for new members. */
export function planIncludesElite(planId: string | null | undefined): boolean {
  return planIncludesCommunity(planId);
}

export function isLegacyBasicPlan(planId: string | null | undefined): boolean {
  return planId === "basic" || planId === "core";
}
