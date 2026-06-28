export {
  DEFAULT_TRANSFORMATION_MAX_PARTICIPANTS,
  getChallengeMaxParticipants,
  isTransformationChallenge,
} from "@/lib/challenge-series";

export const TRANSFORMATION_CHALLENGE_SLUGS = [
  "transformation-30-day",
  "transformation-90-day",
  "transformation-6-month",
  "transformation-12-month",
] as const;

export type TransformationChallengeSlug = (typeof TRANSFORMATION_CHALLENGE_SLUGS)[number];
