import { getChallengeGender, type ChallengeGender } from "@/lib/challenge-gender";
import type { PlatformCopy } from "@/lib/platform-copy";
import type { Challenge } from "@/lib/types";

export type ChallengePlatformCopy = PlatformCopy["challenges"];

/** Pick long-challenge UI copy for the challenge league (men = Alex sarcastic, women = motivating). */
export function resolveChallengePlatformCopy(
  copy: ChallengePlatformCopy,
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation" | "is_flash">
): ChallengePlatformCopy {
  if (challenge.is_flash) {
    return {
      ...copy,
      flash: copy.flashAlex,
      catalog: {
        ...copy.catalog,
        flashSubtitle: copy.catalog.flashSubtitleAlex,
      },
    } as unknown as ChallengePlatformCopy;
  }

  const gender = getChallengeGender(challenge);
  if (gender === "female") {
    return {
      ...copy,
      ...copy.longWomen,
      catalog: {
        ...copy.catalog,
        longSubtitle: copy.catalog.longSubtitleWomen,
      },
    } as unknown as ChallengePlatformCopy;
  }

  return {
    ...copy,
    ...copy.longMen,
    catalog: {
      ...copy.catalog,
      longSubtitle: copy.catalog.longSubtitleMen,
    },
  } as unknown as ChallengePlatformCopy;
}

export function getChallengeLeagueTag(
  copy: ChallengePlatformCopy,
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation" | "is_flash">
): string | null {
  const gender = getChallengeGender(challenge);
  if (!gender) return null;
  return gender === "male" ? copy.leagueTagMen : copy.leagueTagWomen;
}

export function challengeGenderForCopy(
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation" | "is_flash">
): ChallengeGender | null {
  return getChallengeGender(challenge);
}
