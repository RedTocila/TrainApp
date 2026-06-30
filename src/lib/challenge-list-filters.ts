import { getChallengeGender } from "@/lib/challenge-gender";
import { isFlashChallenge } from "@/lib/challenge-series";
import type { Challenge } from "@/lib/types";

export type ChallengeListCategory = "all" | "flash" | "men" | "women";

export const CHALLENGE_LIST_CATEGORIES: ChallengeListCategory[] = [
  "all",
  "flash",
  "men",
  "women",
];

export function filterChallengesByCategory(
  challenges: Challenge[],
  category: ChallengeListCategory
): Challenge[] {
  switch (category) {
    case "flash":
      return challenges.filter((challenge) => isFlashChallenge(challenge));
    case "men":
      return challenges.filter(
        (challenge) => getChallengeGender(challenge) === "male"
      );
    case "women":
      return challenges.filter(
        (challenge) => getChallengeGender(challenge) === "female"
      );
    case "all":
    default:
      return challenges;
  }
}

export function countChallengesByCategory(challenges: Challenge[]) {
  return {
    all: challenges.length,
    flash: challenges.filter((challenge) => isFlashChallenge(challenge)).length,
    men: challenges.filter(
      (challenge) => getChallengeGender(challenge) === "male"
    ).length,
    women: challenges.filter(
      (challenge) => getChallengeGender(challenge) === "female"
    ).length,
  };
}
