"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  getAmbassadorTier,
  getFreeMonthProgress,
  getNextAmbassadorTier,
} from "@/lib/referral-rewards";
import type { AmbassadorTierId } from "@/lib/referral-rewards";

export type ReferralLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  monthlyReferrals: number;
  isCurrentUser: boolean;
};

export type ReferralDashboardData = {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  qualifiedCount: number;
  pendingCount: number;
  creditBalanceCents: number;
  creditsEarnedCents: number;
  moneySavedCents: number;
  ambassadorTier: AmbassadorTierId | null;
  nextAmbassadorTier: AmbassadorTierId | null;
  nextAmbassadorRemaining: number;
  freeMonthProgress: ReturnType<typeof getFreeMonthProgress>;
  leaderboard: ReferralLeaderboardEntry[];
};

function getMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getReferralLeaderboard(
  currentUserId: string
): Promise<ReferralLeaderboardEntry[]> {
  const admin = createAdminClient();
  const { start, end } = getMonthBounds();

  const { data: referrals } = await admin
    .from("referrals")
    .select("referrer_id")
    .eq("status", "qualified")
    .gte("qualified_at", start)
    .lt("qualified_at", end);

  if (!referrals?.length) return [];

  const counts = new Map<string, number>();
  for (const row of referrals) {
    counts.set(row.referrer_id, (counts.get(row.referrer_id) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const userIds = sorted.map(([id]) => id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return sorted.map(([userId, monthlyReferrals], index) => ({
    rank: index + 1,
    userId,
    name: nameById.get(userId) ?? "Member",
    monthlyReferrals,
    isCurrentUser: userId === currentUserId,
  }));
}

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
    .select(
      "referral_code, referral_credit_balance_cents, referral_credits_earned_cents, referral_money_saved_cents, ambassador_tier"
    )
    .eq("id", user.id)
    .single();

  if (!profile?.referral_code) return { error: "Referral code not found" };

  const [
    { count: totalCount },
    { count: qualifiedCount },
    { count: pendingCount },
    leaderboard,
  ] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id),
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
    getReferralLeaderboard(user.id),
  ]);

  const qualified = qualifiedCount ?? 0;
  const currentTier = getAmbassadorTier(qualified);
  const nextTier = getNextAmbassadorTier(qualified);

  return {
    referralCode: profile.referral_code,
    referralLink: `${getAppBaseUrl()}/register?ref=${profile.referral_code}`,
    totalReferrals: totalCount ?? 0,
    qualifiedCount: qualified,
    pendingCount: pendingCount ?? 0,
    creditBalanceCents: profile.referral_credit_balance_cents ?? 0,
    creditsEarnedCents: profile.referral_credits_earned_cents ?? 0,
    moneySavedCents: profile.referral_money_saved_cents ?? 0,
    ambassadorTier: currentTier?.tier ?? profile.ambassador_tier ?? null,
    nextAmbassadorTier: nextTier?.tier ?? null,
    nextAmbassadorRemaining: nextTier ? nextTier.count - qualified : 0,
    freeMonthProgress: getFreeMonthProgress(qualified),
    leaderboard,
  };
}
