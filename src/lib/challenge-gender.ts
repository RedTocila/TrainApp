import type { Challenge } from "@/lib/types";

export type ChallengeGender = "male" | "female";

const LEGACY_MEN_SLUGS = new Set([
  "transformation-30-day",
  "transformation-90-day",
  "transformation-6-month",
  "transformation-12-month",
]);

export function getChallengeGender(
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation">
): ChallengeGender | null {
  if (challenge.gender === "male" || challenge.gender === "female") {
    return challenge.gender;
  }

  if (!challenge.is_transformation && !LEGACY_MEN_SLUGS.has(challenge.slug)) {
    if (challenge.slug.endsWith("-men")) return "male";
    if (challenge.slug.endsWith("-women")) return "female";
    return null;
  }

  if (challenge.slug.endsWith("-women")) return "female";
  if (challenge.slug.endsWith("-men") || LEGACY_MEN_SLUGS.has(challenge.slug)) {
    return "male";
  }

  return null;
}

export function profileGenderToChallengeGender(
  profileGender: string | null | undefined
): ChallengeGender | null {
  if (profileGender === "male") return "male";
  if (profileGender === "female") return "female";
  return null;
}

export function canUserAccessChallenge(
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation" | "is_flash">,
  profileGender: string | null | undefined
): boolean {
  const challengeGender = getChallengeGender(challenge);
  if (!challengeGender) return true;

  const userGender = profileGenderToChallengeGender(profileGender);
  return userGender === challengeGender;
}

export function filterChallengesForProfile(
  challenges: Challenge[],
  profileGender: string | null | undefined
): Challenge[] {
  return challenges.filter((challenge) => canUserAccessChallenge(challenge, profileGender));
}

export function getLongChallengeGenderBlockReason(
  challenge: Pick<Challenge, "gender" | "slug" | "is_transformation">,
  profileGender: string | null | undefined
): string | null {
  const challengeGender = getChallengeGender(challenge);
  if (!challengeGender) return null;

  const userGender = profileGenderToChallengeGender(profileGender);
  if (userGender === challengeGender) return null;

  if (!userGender) {
    return "Set your gender in your profile intake to join long challenges.";
  }

  return challengeGender === "male"
    ? "This long challenge is for men only."
    : "This long challenge is for women only.";
}

/** Card theme key from a transformation slug (e.g. transformation-30-day-men → 30-day). */
export function getTransformationTierKey(slug: string): string {
  const match = slug.match(/^transformation-(.+)-(men|women)$/);
  if (match?.[1]) return match[1];

  const legacy = slug.match(/^transformation-(.+)$/);
  return legacy?.[1] ?? "90-day";
}
