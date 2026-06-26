import type { ReferralDashboardData } from "@/lib/actions/referrals";
import type { PlatformCopy } from "@/lib/platform-copy";
import { formatEurosFromCents } from "@/lib/referral-credits";
import { AMBASSADOR_TIERS } from "@/lib/referral-rewards";

export type ReferralProgramCopy = {
  title: string;
  subtitle: string;
  yourLink: string;
  yourCode: string;
  copyLink: string;
  copyCode: string;
  copied: string;
  share: string;
  totalReferrals: string;
  successfulReferrals: string;
  pendingReferrals: string;
  creditBalance: string;
  creditsEarned: string;
  creditsEarnedLabel: string;
  moneySaved: string;
  moneySavedLabel: string;
  freeMonthHeadline: string;
  freeMonthProgress: string;
  ambassadorTitle: string;
  ambassadorBadge: string | null;
  nextAmbassador: string | null;
  howItWorksTitle: string;
  howItWorks: readonly string[];
  viewProgram: string;
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  leaderboardRank: string;
  leaderboardUser: string;
  leaderboardReferrals: string;
  leaderboardYou: string;
  leaderboardRewards: string;
  creditBalanceLabel: string;
  creditBalanceHint: string;
  ambassadorTiers: readonly { tier: string; count: number; label: string }[];
};

export function getReferralProgramCopy(
  platform: PlatformCopy,
  data: ReferralDashboardData
): ReferralProgramCopy {
  const r = platform.referrals;
  const ambassador = data.ambassadorTier
    ? AMBASSADOR_TIERS.find((tier) => tier.tier === data.ambassadorTier)
    : null;

  const progress = data.freeMonthProgress;
  const freeMonthProgress =
    progress.remaining === 0 && data.qualifiedCount > 0
      ? r.freeMonthComplete
      : r.freeMonthProgress(progress.remaining);

  return {
    title: r.title,
    subtitle: r.subtitle,
    yourLink: r.yourLink,
    yourCode: r.yourCode,
    copyLink: r.copyLink,
    copyCode: r.copyCode,
    copied: r.copied,
    share: r.share,
    totalReferrals: r.totalReferrals,
    successfulReferrals: r.successfulReferrals,
    pendingReferrals: r.pendingReferrals,
    creditBalance: formatEurosFromCents(data.creditBalanceCents),
    creditsEarned: formatEurosFromCents(data.creditsEarnedCents),
    creditsEarnedLabel: r.creditsEarned,
    moneySaved: formatEurosFromCents(data.moneySavedCents),
    moneySavedLabel: r.moneySaved,
    freeMonthHeadline: r.freeMonthHeadline,
    freeMonthProgress,
    ambassadorTitle: r.ambassadorTitle,
    ambassadorBadge: ambassador ? r.ambassadorBadge(ambassador.tier) : null,
    nextAmbassador:
      data.nextAmbassadorTier && data.nextAmbassadorRemaining > 0
        ? r.nextAmbassador(data.nextAmbassadorRemaining, data.nextAmbassadorTier)
        : null,
    howItWorksTitle: r.howItWorksTitle,
    howItWorks: r.howItWorks,
    viewProgram: r.viewProgram,
    leaderboardTitle: r.leaderboardTitle,
    leaderboardSubtitle: r.leaderboardSubtitle,
    leaderboardRank: r.leaderboardRank,
    leaderboardUser: r.leaderboardUser,
    leaderboardReferrals: r.leaderboardReferrals,
    leaderboardYou: r.leaderboardYou,
    leaderboardRewards: r.leaderboardRewards,
    creditBalanceLabel: r.creditBalanceLabel,
    creditBalanceHint: r.creditBalanceHint,
    ambassadorTiers: AMBASSADOR_TIERS.map((tier) => ({
      tier: tier.tier,
      count: tier.count,
      label: r.ambassadorBadge(tier.tier),
    })),
  };
}
