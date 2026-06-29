import type { Challenge, ChallengeParticipant } from "@/lib/types";
import { flashGroupSize } from "@/lib/flash-challenge-entry-fee";
import { getChallengePhase } from "@/lib/challenge-utils";
import { getChallengeMaxParticipants, isFlashChallenge } from "@/lib/challenge-series";

export const FLASH_MIN_PARTICIPANTS_TO_START = 10;
export const FLASH_MAX_GROUPS = 5;

export function flashParticipantsNeededToStart(participantCount: number): number {
  return Math.max(0, FLASH_MIN_PARTICIPANTS_TO_START - participantCount);
}

export function flashCanAdminStart(participantCount: number): boolean {
  return participantCount >= FLASH_MIN_PARTICIPANTS_TO_START;
}

/** True after the organizer manually starts the challenge (phase > 0). */
export function flashChallengeHasStarted(
  challenge: Pick<Challenge, "current_phase" | "is_flash" | "slug">
): boolean {
  if (!isFlashChallenge(challenge)) return false;
  return getChallengePhase(challenge) > 0;
}

export function flashChallengeIsFilling(
  challenge: Pick<Challenge, "current_phase" | "is_flash" | "slug">
): boolean {
  if (!isFlashChallenge(challenge)) return false;
  return getChallengePhase(challenge) === 0;
}

export function buildJoinOrderRankMap(
  participants: Pick<ChallengeParticipant, "id" | "created_at">[]
): Map<string, number> {
  const sorted = participantIdsByJoinOrder(participants);
  return new Map(sorted.map((id, index) => [id, index + 1]));
}

export function flashMaxGroupCount(challenge: Pick<Challenge, "group_size" | "max_participants" | "is_flash">): number {
  const groupSize = flashGroupSize(challenge);
  const maxParticipants = getChallengeMaxParticipants(challenge) ?? FLASH_MIN_PARTICIPANTS_TO_START * FLASH_MAX_GROUPS;
  return Math.min(FLASH_MAX_GROUPS, Math.ceil(maxParticipants / groupSize));
}

export function participantIdsByJoinOrder(
  participants: Pick<ChallengeParticipant, "id" | "created_at">[]
): string[] {
  return [...participants]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((participant) => participant.id);
}

export function compareFlashPerformance(a: number | null | undefined, b: number | null | undefined): number {
  const scoreA = typeof a === "number" ? a : -1;
  const scoreB = typeof b === "number" ? b : -1;
  return scoreB - scoreA;
}
