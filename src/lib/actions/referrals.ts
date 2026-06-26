"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getEarnedMilestones, getNextMilestone } from "@/lib/referral-rewards";

export type ReferralDashboardData = {
  referralCode: string;
  referralLink: string;
  qualifiedCount: number;
  pendingCount: number;
  founderBadge: boolean;
  claimedMilestones: number[];
  nextMilestoneCount: number | null;
};

export async function getReferralDashboardData(): Promise<
  ReferralDashboardData | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, founder_badge")
    .eq("id", user.id)
    .single();

  if (!profile?.referral_code) return { error: "Referral code not found" };

  const [{ count: qualifiedCount }, { count: pendingCount }, { data: claims }] =
    await Promise.all([
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .eq("status", "qualified"),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("referral_reward_claims")
        .select("milestone")
        .eq("user_id", user.id),
    ]);

  const qualified = qualifiedCount ?? 0;
  const next = getNextMilestone(qualified);

  return {
    referralCode: profile.referral_code,
    referralLink: `${getAppBaseUrl()}/register?ref=${profile.referral_code}`,
    qualifiedCount: qualified,
    pendingCount: pendingCount ?? 0,
    founderBadge: profile.founder_badge ?? false,
    claimedMilestones: (claims ?? []).map((row) => row.milestone),
    nextMilestoneCount: next?.count ?? null,
  };
}

export async function getReferralProgressSummary() {
  const data = await getReferralDashboardData();
  if ("error" in data) return null;

  const earned = getEarnedMilestones(data.qualifiedCount);
  const next = getNextMilestone(data.qualifiedCount);

  return {
    ...data,
    earnedCount: earned.length,
    next,
  };
}
