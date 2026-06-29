import {
  FLASH_CHALLENGE_SLUGS,
  type FlashChallengeSlug,
} from "@/lib/flash-challenge-catalog";
import {
  TRANSFORMATION_CHALLENGE_SLUGS,
  type TransformationChallengeSlug,
} from "@/lib/transformation-challenges";
import type { Challenge } from "@/lib/types";

export const DEFAULT_TRANSFORMATION_MAX_PARTICIPANTS = 100;
export const DEFAULT_FLASH_MAX_PARTICIPANTS = 50;
export const DEFAULT_FLASH_PRIZE_CENTS_PER_PARTICIPANT = 500;
export const DEFAULT_FLASH_ENTRY_FEE_CENTS = 1000;

export type ChallengeSeries = "transformation" | "flash";

export function isTransformationChallenge(
  challenge: Pick<Challenge, "is_transformation" | "slug">
): boolean {
  return (
    challenge.is_transformation === true ||
    TRANSFORMATION_CHALLENGE_SLUGS.includes(challenge.slug as TransformationChallengeSlug)
  );
}

export function isFlashChallenge(
  challenge: Pick<Challenge, "is_flash" | "slug">
): boolean {
  return (
    challenge.is_flash === true ||
    FLASH_CHALLENGE_SLUGS.includes(challenge.slug as FlashChallengeSlug)
  );
}

export function isSeriesChallenge(challenge: Pick<Challenge, "is_transformation" | "is_flash" | "slug">): boolean {
  return isTransformationChallenge(challenge) || isFlashChallenge(challenge);
}

export function getChallengeSeries(
  challenge: Pick<Challenge, "is_transformation" | "is_flash" | "slug">
): ChallengeSeries | null {
  if (isFlashChallenge(challenge)) return "flash";
  if (isTransformationChallenge(challenge)) return "transformation";
  return null;
}

export function getChallengeMaxParticipants(
  challenge: Pick<Challenge, "max_participants" | "is_transformation" | "is_flash">
): number | null {
  if (typeof challenge.max_participants === "number") return challenge.max_participants;
  if (challenge.is_flash) return DEFAULT_FLASH_MAX_PARTICIPANTS;
  if (challenge.is_transformation) return DEFAULT_TRANSFORMATION_MAX_PARTICIPANTS;
  return null;
}

export function getChallengeEntryFeeCents(
  challenge: Pick<Challenge, "entry_fee_cents" | "is_flash">
): number {
  if (typeof challenge.entry_fee_cents === "number" && challenge.entry_fee_cents > 0) {
    return challenge.entry_fee_cents;
  }
  if (challenge.is_flash) return DEFAULT_FLASH_ENTRY_FEE_CENTS;
  return 0;
}

export function usesChallengeWaitlist(
  challenge: Pick<Challenge, "is_transformation" | "is_flash" | "slug">
): boolean {
  return isTransformationChallenge(challenge) || isFlashChallenge(challenge);
}
