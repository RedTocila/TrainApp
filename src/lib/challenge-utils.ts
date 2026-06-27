import type { Challenge } from "@/lib/types";

export type ChallengeStatus = "upcoming" | "live" | "ended";

export function getChallengeStatus(challenge: Challenge, now = new Date()): ChallengeStatus {
  const start = new Date(challenge.scheduled_at);
  const end = new Date(start.getTime() + challenge.duration_minutes * 60_000);

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
