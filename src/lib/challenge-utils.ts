import type { Challenge, ChallengeBracketData, ChallengePhase } from "@/lib/types";

export const DEFAULT_PRIZE_POOL_CENTS_PER_PARTICIPANT = 1000;

export const DEFAULT_CHALLENGE_DURATION_MONTHS = 3;

export const ROUND1_ADVANCE_COUNT = 5;

export type ChallengeStatus = "upcoming" | "live" | "ended";

export function getChallengeDurationMonths(
  challenge: Pick<Challenge, "duration_months">
): number {
  return challenge.duration_months ?? DEFAULT_CHALLENGE_DURATION_MONTHS;
}

export function getChallengeEndDate(challenge: Challenge): Date {
  const end = new Date(challenge.scheduled_at);
  end.setMonth(end.getMonth() + getChallengeDurationMonths(challenge));
  return end;
}

export function getChallengeStatus(challenge: Challenge, now = new Date()): ChallengeStatus {
  const start = new Date(challenge.scheduled_at);
  const end = getChallengeEndDate(challenge);

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "ended";
}

export function canJoinChallenge(challenge: Challenge, now = new Date()): boolean {
  const status = getChallengeStatus(challenge, now);
  if (status === "live") return true;
  if (status !== "upcoming") return false;

  const start = new Date(challenge.scheduled_at);
  const joinOpens = new Date(start.getTime() - 15 * 60_000);
  return now >= joinOpens;
}

export function challengeExcerpt(description: string, maxLength = 140): string {
  const plain = description.replace(/[#*_\n]/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
}

export function getPrizePoolCentsPerParticipant(
  challenge: Pick<Challenge, "prize_pool_cents_per_participant">
): number {
  return challenge.prize_pool_cents_per_participant ?? DEFAULT_PRIZE_POOL_CENTS_PER_PARTICIPANT;
}

export function getChallengePrizePoolCents(
  challenge: Pick<Challenge, "prize_pool_cents_per_participant">,
  participantCount: number
): number {
  return participantCount * getPrizePoolCentsPerParticipant(challenge);
}

export function getChallengePhase(challenge: Pick<Challenge, "current_phase">): ChallengePhase {
  return (challenge.current_phase ?? 0) as ChallengePhase;
}

export function groupScheduledAt(baseZoomAt: string | null, groupIndex: number): string | null {
  if (!baseZoomAt) return null;
  const date = new Date(baseZoomAt);
  date.setHours(date.getHours() + groupIndex);
  return date.toISOString();
}

/** Spread three elimination Zoom days across a tournament of any length (1–24 months). */
export function suggestChallengeZoomDates(
  scheduledAt: string,
  durationMonths: number
): {
  round_1_zoom_at: string;
  round_2_zoom_at: string;
  round_3_zoom_at: string;
} {
  const months = Math.max(1, durationMonths);
  const start = new Date(scheduledAt);

  const addMonths = (base: Date, count: number) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + count);
    return d;
  };

  if (months === 1) {
    const r1 = addMonths(start, 0);
    r1.setDate(r1.getDate() + 7);
    const r2 = addMonths(start, 0);
    r2.setDate(r2.getDate() + 14);
    const r3 = addMonths(start, 0);
    r3.setDate(r3.getDate() + 21);
    return {
      round_1_zoom_at: r1.toISOString(),
      round_2_zoom_at: r2.toISOString(),
      round_3_zoom_at: r3.toISOString(),
    };
  }

  const r1Month = Math.max(1, Math.round(months / 3));
  const r2Month = Math.max(r1Month + 1, Math.round((months * 2) / 3));
  const r3Month = months;

  return {
    round_1_zoom_at: addMonths(start, r1Month).toISOString(),
    round_2_zoom_at: addMonths(start, Math.min(r2Month, months - 1)).toISOString(),
    round_3_zoom_at: addMonths(start, r3Month).toISOString(),
  };
}

export function getSurvivorCount(bracket: ChallengeBracketData): number {
  if (bracket.champion) return 1;
  if (bracket.round3Group) {
    return bracket.round3Group.members.filter(
      (m) => m.outcome !== "eliminated" && m.status !== "eliminated"
    ).length;
  }
  if (bracket.round2Groups.length > 0) {
    const winners = bracket.round2Groups.filter((g) =>
      g.members.some((m) => m.outcome === "group_winner")
    ).length;
    if (winners > 0) return winners;
    return bracket.round2Groups.reduce((sum, g) => sum + g.members.length, 0);
  }
  if (bracket.round1Groups.length > 0) {
    const advanced = bracket.round1Groups.flatMap((g) =>
      g.members.filter((m) => m.outcome === "advanced")
    ).length;
    if (advanced > 0) return advanced;
    return bracket.round1Groups.reduce((sum, g) => sum + g.members.length, 0);
  }
  return bracket.participants.filter((p) => p.status !== "eliminated").length;
}

export function isRound1Complete(bracket: ChallengeBracketData): boolean {
  if (bracket.round1Groups.length === 0) return false;
  return bracket.round1Groups.every((group) => {
    const advanced = group.members.filter((m) => m.outcome === "advanced").length;
    return advanced === ROUND1_ADVANCE_COUNT;
  });
}

export function isRound2Complete(bracket: ChallengeBracketData): boolean {
  if (bracket.round2Groups.length === 0) return false;
  return bracket.round2Groups.every((group) =>
    group.members.some((m) => m.outcome === "group_winner")
  );
}

export function partitionChallenges(challenges: Challenge[]) {
  const live: Challenge[] = [];
  const upcoming: Challenge[] = [];
  const ended: Challenge[] = [];

  for (const challenge of challenges) {
    const status = getChallengeStatus(challenge);
    if (status === "live") live.push(challenge);
    else if (status === "upcoming") upcoming.push(challenge);
    else ended.push(challenge);
  }

  const byScheduledDesc = (a: Challenge, b: Challenge) =>
    new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();

  live.sort(byScheduledDesc);
  upcoming.sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  ended.sort(byScheduledDesc);

  return { live, upcoming, ended };
}

export function hasLiveChallenge(challenges: Challenge[], now = new Date()): boolean {
  return challenges.some((challenge) => getChallengeStatus(challenge, now) === "live");
}

/** Projected field size at each elimination round for funnel visuals. */
export function computeTournamentFunnelCounts(
  entrantCount: number,
  groupSize: number
): { start: number; afterR1: number; afterR2: number; champion: number } {
  if (entrantCount <= 0) {
    return { start: 0, afterR1: 0, afterR2: 0, champion: 0 };
  }
  const numGroupsR1 = Math.ceil(entrantCount / groupSize);
  const afterR1 = numGroupsR1 * ROUND1_ADVANCE_COUNT;
  const numGroupsR2 = Math.max(1, Math.ceil(afterR1 / groupSize));
  const afterR2 = numGroupsR2;
  return { start: entrantCount, afterR1, afterR2, champion: 1 };
}
