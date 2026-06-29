export {
  DEFAULT_TRANSFORMATION_MAX_PARTICIPANTS,
  getChallengeMaxParticipants,
  isTransformationChallenge,
} from "@/lib/challenge-series";

export const TRANSFORMATION_CHALLENGE_SLUGS = [
  "transformation-30-day-men",
  "transformation-30-day-women",
  "transformation-90-day-men",
  "transformation-90-day-women",
  "transformation-6-month-men",
  "transformation-6-month-women",
  "transformation-12-month-men",
  "transformation-12-month-women",
] as const;

export type TransformationChallengeSlug = (typeof TRANSFORMATION_CHALLENGE_SLUGS)[number];

export const TRANSFORMATION_TIER_KEYS = [
  "30-day",
  "90-day",
  "6-month",
  "12-month",
] as const;

export type TransformationTierKey = (typeof TRANSFORMATION_TIER_KEYS)[number];

export const TRANSFORMATION_GENDERS = ["men", "women"] as const;
export type TransformationGenderSuffix = (typeof TRANSFORMATION_GENDERS)[number];
