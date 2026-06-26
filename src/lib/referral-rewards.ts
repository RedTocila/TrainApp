import { PLATFORM_AI_NAME } from "@/lib/brand";

export type ReferralMilestone = {
  count: number;
  months: number | null;
  lifetime?: boolean;
  founderBadge?: boolean;
  label: string;
};

export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { count: 1, months: 1, label: `1 month ${PLATFORM_AI_NAME}` },
  { count: 3, months: 2, label: `2 months ${PLATFORM_AI_NAME}` },
  { count: 5, months: 3, label: `3 months ${PLATFORM_AI_NAME}` },
  { count: 10, months: 6, label: `6 months ${PLATFORM_AI_NAME}` },
  { count: 15, months: 12, label: `1 year ${PLATFORM_AI_NAME}` },
  {
    count: 25,
    months: null,
    lifetime: true,
    founderBadge: true,
    label: `Lifetime ${PLATFORM_AI_NAME} + Founder badge`,
  },
];

export function getNextMilestone(qualifiedCount: number): ReferralMilestone | null {
  return REFERRAL_MILESTONES.find((m) => m.count > qualifiedCount) ?? null;
}

export function getEarnedMilestones(qualifiedCount: number): ReferralMilestone[] {
  return REFERRAL_MILESTONES.filter((m) => m.count <= qualifiedCount);
}
