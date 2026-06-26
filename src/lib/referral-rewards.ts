export type AmbassadorTierId = "bronze" | "silver" | "gold" | "elite";

export type AmbassadorTier = {
  tier: AmbassadorTierId;
  count: number;
  label: string;
};

export const AMBASSADOR_TIERS: AmbassadorTier[] = [
  { tier: "bronze", count: 5, label: "Bronze Ambassador" },
  { tier: "silver", count: 15, label: "Silver Ambassador" },
  { tier: "gold", count: 30, label: "Gold Ambassador" },
  { tier: "elite", count: 75, label: "Elite Ambassador" },
];

export const REFERRALS_FOR_FREE_MONTH = 4;

export function getAmbassadorTier(qualifiedCount: number): AmbassadorTier | null {
  let earned: AmbassadorTier | null = null;
  for (const tier of AMBASSADOR_TIERS) {
    if (qualifiedCount >= tier.count) earned = tier;
  }
  return earned;
}

export function getNextAmbassadorTier(qualifiedCount: number): AmbassadorTier | null {
  return AMBASSADOR_TIERS.find((tier) => qualifiedCount < tier.count) ?? null;
}

export function getFreeMonthProgress(qualifiedCount: number): {
  current: number;
  target: number;
  remaining: number;
  percent: number;
} {
  const current = qualifiedCount % REFERRALS_FOR_FREE_MONTH;
  const remaining = REFERRALS_FOR_FREE_MONTH - current;
  const percent = (current / REFERRALS_FOR_FREE_MONTH) * 100;
  return {
    current,
    target: REFERRALS_FOR_FREE_MONTH,
    remaining: current === 0 && qualifiedCount > 0 ? 0 : remaining,
    percent: current === 0 && qualifiedCount > 0 ? 100 : percent,
  };
}
