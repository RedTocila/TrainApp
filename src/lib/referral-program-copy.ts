import type { ReferralDashboardData } from "@/lib/actions/referrals";
import type { PlatformCopy } from "@/lib/platform-copy";

export type ReferralProgramCopy = {
  title: string;
  subtitle: string;
  yourLink: string;
  copyLink: string;
  copied: string;
  successfulReferrals: string;
  pendingReferrals: string;
  founderBadge: string;
  rewardsTitle: string;
  referralsColumn: string;
  rewardColumn: string;
  howItWorksTitle: string;
  howItWorks: readonly string[];
  nextMilestoneText: string | null;
  allMilestonesUnlocked: string;
  viewProgram: string;
  unlocked: string;
  locked: string;
  nextReward: string;
  previousReward: string;
  nextRewardNav: string;
  milestoneRewards: readonly { count: number; label: string; atReferrals: string }[];
};

export function getReferralProgramCopy(
  platform: PlatformCopy,
  data: ReferralDashboardData
): ReferralProgramCopy {
  const r = platform.referrals;
  const nextMilestone = r.milestoneRewards.find((m) => m.count === data.nextMilestoneCount);
  const remaining =
    nextMilestone != null ? nextMilestone.count - data.qualifiedCount : 0;

  return {
    title: r.title,
    subtitle: r.subtitle,
    yourLink: r.yourLink,
    copyLink: r.copyLink,
    copied: r.copied,
    successfulReferrals: r.successfulReferrals,
    pendingReferrals: r.pendingReferrals,
    founderBadge: r.founderBadge,
    rewardsTitle: r.rewardsTitle,
    referralsColumn: r.referralsColumn,
    rewardColumn: r.rewardColumn,
    howItWorksTitle: r.howItWorksTitle,
    howItWorks: r.howItWorks,
    allMilestonesUnlocked: r.allMilestonesUnlocked,
    viewProgram: r.viewProgram,
    unlocked: r.unlocked,
    locked: r.locked,
    nextReward: r.nextReward,
    previousReward: r.previousReward,
    nextRewardNav: r.nextRewardNav,
    milestoneRewards: r.milestoneRewards.map((m) => ({
      count: m.count,
      label: m.label,
      atReferrals: r.atReferrals(m.count),
    })),
    nextMilestoneText:
      nextMilestone && remaining > 0
        ? r.nextMilestone(nextMilestone.count, remaining)
        : null,
  };
}
