import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";
import { EXERCISE_CATALOG, type CatalogExercise } from "@/lib/exercise-catalog";
import { formatCurrencyAmount } from "@/lib/checkout-i18n";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription-plans";

export const MCP_SEARCH_DEFAULT_LIMIT = 5;
export const MCP_SEARCH_MAX_LIMIT = 8;
const DESCRIPTION_MAX = 180;

export type PublicPlanSummary = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string;
  includesFrom: string | null;
  features: string[];
};

export type ExerciseMatch = {
  id: string;
  name: string;
  category: string;
  bodyParts: string[];
  equipment: string[];
  primaryMuscles: string[];
  description: string | null;
};

function euros(cents: number): string {
  return formatCurrencyAmount(cents);
}

function summarizePlan(plan: SubscriptionPlan): PublicPlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    monthlyPrice: `${euros(plan.monthly.amountEurCents)}/month`,
    annualPrice: `${euros(plan.annual.amountEurCents)}/year`,
    includesFrom: plan.includesFrom ?? null,
    features: plan.features,
  };
}

/** Sold plans only. Legacy Basic and Core are not offered to new customers. */
export function listPublicPlans(): { plans: PublicPlanSummary[]; pricingUrl: string } {
  return {
    plans: SUBSCRIPTION_PLANS.map(summarizePlan),
    pricingUrl: `${CANONICAL_SITE_ORIGIN}/pricing`,
  };
}

function clip(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= DESCRIPTION_MAX) return trimmed;
  return `${trimmed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

function toMatch(exercise: CatalogExercise): ExerciseMatch {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    bodyParts: exercise.body_parts,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primary_muscles,
    description: clip(exercise.description),
  };
}

function searchableText(exercise: CatalogExercise): string {
  return [
    exercise.name,
    exercise.category,
    ...exercise.body_parts,
    ...exercise.equipment,
    ...exercise.primary_muscles,
    ...exercise.secondary_muscles,
    exercise.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesQuery(exercise: CatalogExercise, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) return false;
  const haystack = searchableText(exercise);
  return tokens.every((token) => haystack.includes(token));
}

export function searchPublicExercises(input: {
  query: string;
  limit?: number;
  muscle?: string;
  equipment?: string;
}): { query: string; limit: number; totalMatches: number; exercises: ExerciseMatch[] } {
  const limit = Math.min(
    MCP_SEARCH_MAX_LIMIT,
    Math.max(1, input.limit ?? MCP_SEARCH_DEFAULT_LIMIT)
  );
  const query = input.query.trim();
  const muscle = input.muscle?.trim().toLowerCase();
  const equipment = input.equipment?.trim().toLowerCase();

  const matches = EXERCISE_CATALOG.exercises.filter((exercise) => {
    if (muscle) {
      const muscles = [...exercise.primary_muscles, ...exercise.secondary_muscles].map((item) =>
        item.toLowerCase()
      );
      if (!muscles.some((item) => item.includes(muscle))) return false;
    }
    if (equipment) {
      if (!exercise.equipment.some((item) => item.toLowerCase().includes(equipment))) return false;
    }
    return matchesQuery(exercise, query);
  });

  const ranked = [...matches].sort((a, b) => {
    const aName = a.name.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
    const bName = b.name.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
    return aName - bName || a.name.localeCompare(b.name);
  });

  return {
    query,
    limit,
    totalMatches: ranked.length,
    exercises: ranked.slice(0, limit).map(toMatch),
  };
}

export function getPublicCoachingFeatures() {
  const plans = listPublicPlans();
  return {
    product: "RUTINA",
    summary:
      "RUTINA is an AI fitness coach. Free includes logging and tracking. Plus adds AI plans and reports. Pro adds AI Coach, adjustments, and live classes or challenges where available.",
    workoutCoaching: [
      "AI workout generator with warm-up, main session, and stretch",
      "Personalized recommendations and automatic workout adjustments",
      "Exercise catalogue with muscles and equipment",
      "AI fitness chat",
    ],
    nutritionCoaching: [
      "AI nutrition coach",
      "AI meal suggestions",
      "Automatic calorie and macro recommendations",
    ],
    plans: plans.plans.map((plan) => ({
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice,
      includesFrom: plan.includesFrom,
    })),
    links: {
      home: CANONICAL_SITE_ORIGIN,
      pricing: `${CANONICAL_SITE_ORIGIN}/pricing`,
      signup: `${CANONICAL_SITE_ORIGIN}/register`,
    },
    accountNote:
      "Personalized plans, saved workouts, and nutrition logs require a Rutina account. This connector only describes public coaching. It cannot create an account or generate a private plan.",
  };
}
