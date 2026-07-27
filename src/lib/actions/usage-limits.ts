"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getLimitExceededMessage } from "@/lib/subscription-messages";
import {
  alexUsageKey,
  aiPlanUsageKey,
  getAiPlanMonthlyLimit,
  getAlexDailyLimit,
  hasUnlimitedAiPlans,
} from "@/lib/subscription-limits";
import type { Profile } from "@/lib/types";

async function getUsageCount(userId: string, counterKey: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("counter_key", counterKey)
    .maybeSingle();
  return data?.count ?? 0;
}

async function incrementUsageCount(userId: string, counterKey: string): Promise<number> {
  const admin = createAdminClient();
  const current = await getUsageCount(userId, counterKey);
  const next = current + 1;

  if (current === 0) {
    await admin.from("user_usage_counters").insert({
      user_id: userId,
      counter_key: counterKey,
      count: 1,
    });
    return 1;
  }

  await admin
    .from("user_usage_counters")
    .update({ count: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("counter_key", counterKey);

  return next;
}

function limitMessage(profile: Profile): string {
  return getLimitExceededMessage(parseCheckoutLocale(profile.preferred_locale));
}

export async function checkAlexCommandAllowed(
  profile: Profile
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const limit = getAlexDailyLimit(profile);
  if (limit == null) return { allowed: true };
  if (limit <= 0) {
    return { allowed: false, error: limitMessage(profile) };
  }

  const used = await getUsageCount(profile.id, alexUsageKey());
  if (used >= limit) {
    return { allowed: false, error: limitMessage(profile) };
  }
  return { allowed: true };
}

export async function consumeAlexCommand(profile: Profile): Promise<void> {
  const limit = getAlexDailyLimit(profile);
  if (limit == null || limit <= 0) return;
  await incrementUsageCount(profile.id, alexUsageKey());
}

export async function checkAiPlanApplyAllowed(
  profile: Profile,
  type: "workout" | "nutrition"
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const limit = getAiPlanMonthlyLimit(profile, type);
  if (limit == null) return { allowed: true };
  if (limit <= 0) {
    return { allowed: false, error: limitMessage(profile) };
  }

  const used = await getUsageCount(profile.id, aiPlanUsageKey(type));
  if (used >= limit) {
    return { allowed: false, error: limitMessage(profile) };
  }
  return { allowed: true };
}

export async function consumeAiPlanApply(
  profile: Profile,
  type: "workout" | "nutrition"
): Promise<void> {
  if (hasUnlimitedAiPlans(profile)) return;
  await incrementUsageCount(profile.id, aiPlanUsageKey(type));
}

export async function countPersonalPlans(userId: string): Promise<number> {
  const admin = createAdminClient();
  const [{ count: workoutCount }, { count: nutritionCount }] = await Promise.all([
    admin
      .from("workout_plans")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("is_personal", true),
    admin
      .from("nutrition_plans")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("is_personal", true),
  ]);
  return (workoutCount ?? 0) + (nutritionCount ?? 0);
}

/** Manual plans are free for every authenticated client. */
export async function checkManualPlanCreationAllowed(
  profile: Profile
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  if (!profile) return { allowed: false, error: "Not authenticated" };
  return { allowed: true };
}

export async function ensurePlanMutationAccess(): Promise<
  | { profile: Profile; userId: string; admin: ReturnType<typeof createAdminClient> }
  | { error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  const admin = createAdminClient();
  return { profile, userId: profile.id, admin };
}

export async function ensureManualPlanCreation(): Promise<
  | { profile: Profile; userId: string; admin: ReturnType<typeof createAdminClient> }
  | { error: string }
> {
  return ensurePlanMutationAccess();
}
