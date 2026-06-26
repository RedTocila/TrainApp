import { createAdminClient } from "@/lib/supabase/admin";
import { getReferralLeaderboard } from "@/lib/actions/referrals";

const LEADERBOARD_REWARD_MONTHS: Record<number, number> = {
  1: 6,
  2: 3,
  3: 3,
};

function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function extendPremium(
  userId: string,
  months: number,
  metadata: { period: string; rank: number }
): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_expires_at")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const base = profile.subscription_expires_at
    ? new Date(Math.max(Date.now(), new Date(profile.subscription_expires_at).getTime()))
    : new Date();

  await admin
    .from("profiles")
    .update({
      subscription_plan: "ai",
      subscription_status: "active",
      subscription_interval: "monthly",
      subscription_expires_at: addMonths(base, months).toISOString(),
    })
    .eq("id", userId);

  await admin.from("notifications").insert({
    user_id: userId,
    type: "referral_leaderboard",
    title: "Monthly referral leaderboard reward",
    body: `You ranked #${metadata.rank} last month and earned ${months} month${months === 1 ? "" : "s"} of Premium.`,
    metadata: { ...metadata, months },
  });
}

export async function processMonthlyLeaderboardRewards(): Promise<{
  rewarded: { userId: string; rank: number; months: number }[];
}> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodKey = monthStart.toISOString().slice(0, 7);

  const { data: referrals } = await admin
    .from("referrals")
    .select("referrer_id")
    .eq("status", "qualified")
    .gte("qualified_at", monthStart.toISOString())
    .lt("qualified_at", monthEnd.toISOString());

  if (!referrals?.length) return { rewarded: [] };

  const counts = new Map<string, number>();
  for (const row of referrals) {
    counts.set(row.referrer_id, (counts.get(row.referrer_id) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rewarded: { userId: string; rank: number; months: number }[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const rank = index + 1;
    const [userId] = sorted[index];
    const months = LEADERBOARD_REWARD_MONTHS[rank] ?? (rank <= 10 ? 1 : 0);
    if (!months) continue;

    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "referral_leaderboard")
      .contains("metadata", { period: periodKey })
      .maybeSingle();

    if (existing) continue;

    await extendPremium(userId, months, { period: periodKey, rank });
    rewarded.push({ userId, rank, months });
  }

  return { rewarded };
}
