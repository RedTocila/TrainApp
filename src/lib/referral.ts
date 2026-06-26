import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERRAL_MILESTONES } from "@/lib/referral-rewards";
import { orderQualifiesReferral } from "@/lib/referral-config";
import { createAdminClient } from "@/lib/supabase/admin";

const LIFETIME_EXPIRES_AT = "2099-12-31T23:59:59.000Z";

function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function normalizeReferralCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function attachReferralOnSignup(
  supabase: SupabaseClient,
  userId: string,
  referralCode: string | null
): Promise<void> {
  const code = normalizeReferralCode(referralCode);
  if (!code) return;

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer || referrer.id === userId) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .single();

  if (existing?.referred_by) return;

  await supabase.from("profiles").update({ referred_by: referrer.id }).eq("id", userId);

  await admin.from("referrals").upsert(
    {
      referrer_id: referrer.id,
      referred_id: userId,
      status: "pending",
    },
    { onConflict: "referred_id", ignoreDuplicates: true }
  );
}

export async function qualifyReferralForUser(
  userId: string,
  order?: {
    plan: string;
    billing_interval: string;
    order_kind?: string | null;
  }
): Promise<void> {
  if (order && !orderQualifiesReferral(order)) return;

  const admin = createAdminClient();

  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_id", userId)
    .maybeSingle();

  if (!referral || referral.status === "qualified") return;

  const now = new Date().toISOString();
  await admin
    .from("referrals")
    .update({ status: "qualified", qualified_at: now })
    .eq("id", referral.id);

  await processReferrerMilestones(referral.referrer_id);
}

async function processReferrerMilestones(referrerId: string): Promise<void> {
  const admin = createAdminClient();

  const { count } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .eq("status", "qualified");

  const qualifiedCount = count ?? 0;
  if (qualifiedCount === 0) return;

  const { data: claimed } = await admin
    .from("referral_reward_claims")
    .select("milestone")
    .eq("user_id", referrerId);

  const claimedSet = new Set((claimed ?? []).map((row) => row.milestone));

  for (const milestone of REFERRAL_MILESTONES) {
    if (qualifiedCount < milestone.count || claimedSet.has(milestone.count)) continue;

    await grantMilestoneReward(referrerId, milestone);
    await admin.from("referral_reward_claims").insert({
      user_id: referrerId,
      milestone: milestone.count,
      reward_label: milestone.label,
    });

    await admin.from("notifications").insert({
      user_id: referrerId,
      type: "referral_reward",
      title: "Referral reward unlocked",
      body: `You reached ${milestone.count} successful referrals — ${milestone.label}.`,
      metadata: { milestone: milestone.count, reward: milestone.label },
    });
  }
}

async function grantMilestoneReward(
  userId: string,
  milestone: (typeof REFERRAL_MILESTONES)[number]
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_plan, subscription_status, subscription_expires_at, founder_badge")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const updates: Record<string, unknown> = {
    subscription_plan: "ai",
    subscription_status: "active",
    subscription_interval: "monthly",
  };

  if (milestone.lifetime) {
    updates.subscription_expires_at = LIFETIME_EXPIRES_AT;
    updates.founder_badge = true;
  } else if (milestone.months) {
    const base = profile.subscription_expires_at
      ? new Date(
          Math.max(Date.now(), new Date(profile.subscription_expires_at).getTime())
        )
      : new Date();
    updates.subscription_expires_at = addMonths(base, milestone.months).toISOString();
  }

  if (milestone.founderBadge) {
    updates.founder_badge = true;
  }

  await admin.from("profiles").update(updates).eq("id", userId);
}
