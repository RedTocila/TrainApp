import { hasAiAccess, hasPaidAccess, hasPlusAccess } from "@/lib/subscription";
import { isLegacyBasicPlan } from "@/lib/subscription-plans";
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
  return hasPaidAccess(profile) && isLegacyBasicPlan(profile.subscription_plan);
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

/**
 * Free and Plus: no open coach chat.
 * Legacy Basic: limited daily commands.
 * Pro, legacy AI Pro, and Elite: unlimited.
 */
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

/** AI workout and nutrition builders are Plus (and every higher or legacy paid plan). */
export function hasAiPlanBuilderAccess(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  return hasPlusAccess(profile);
}

export function hasUnlimitedAiPlans(
  profile: Pick<
    Profile,
    "role" | "subscription_plan" | "subscription_status" | "subscription_expires_at"
  >
): boolean {
  if (profile.role === "admin") return true;
  return hasPlusAccess(profile) && !isBasicTier(profile);
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
  return `alex:${calendarDayKey(date)}`;
}

export function aiPlanUsageKey(
  type: "workout" | "nutrition",
  date = new Date()
): string {
  return `ai_${type}:${calendarMonthKey(date)}`;
}

/** App calendar day in Europe/Tirane (not UTC midnight). */
function calendarDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calendarMonthKey(date: Date): string {
  return calendarDayKey(date).slice(0, 7);
}
