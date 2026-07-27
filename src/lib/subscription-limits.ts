import { hasAiAccess, hasPaidAccess } from "@/lib/subscription";
import type { Profile } from "@/lib/types";

/** @deprecated Legacy Basic subscribers only — Basic is no longer sold. */
export const BASIC_ALEX_COMMANDS_PER_DAY = 10;
/** @deprecated Legacy Basic subscribers only. */
export const BASIC_AI_PLANS_PER_MONTH = 1;

/** Grandfathered Basic/Core paid subscribers (plan no longer sold). */
export function isBasicTier(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return false;
  return hasPaidAccess(profile) && !hasAiAccess(profile);
}

export function hasUnlimitedAlexCommands(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  return hasAiAccess(profile);
}

/** Free accounts: no AI. Legacy Basic: limited. AI/Elite: unlimited. */
export function getAlexDailyLimit(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): number | null {
  if (hasUnlimitedAlexCommands(profile)) return null;
  if (isBasicTier(profile)) return BASIC_ALEX_COMMANDS_PER_DAY;
  return 0;
}

/** AI plan builders require AI Pro / Elite (or legacy Basic allowance). */
export function hasAiPlanBuilderAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  if (hasAiAccess(profile)) return true;
  return isBasicTier(profile);
}

export function hasUnlimitedAiPlans(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  return hasAiAccess(profile);
}

export function getAiPlanMonthlyLimit(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >,
  _type: "workout" | "nutrition"
): number | null {
  if (hasUnlimitedAiPlans(profile)) return null;
  if (isBasicTier(profile)) return BASIC_AI_PLANS_PER_MONTH;
  return 0;
}

export function alexUsageKey(date = new Date()): string {
  return `alex:${date.toISOString().slice(0, 10)}`;
}

export function aiPlanUsageKey(
  type: "workout" | "nutrition",
  date = new Date()
): string {
  return `ai_${type}:${date.toISOString().slice(0, 7)}`;
}
