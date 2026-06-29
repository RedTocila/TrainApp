"use server";

import type { ChallengeBracketData } from "@/lib/types";
import { enrichBracketWithPlatformScores } from "@/lib/challenge-platform-scores";
import { getPlatformEngagementScores } from "@/lib/actions/platform-engagement-score";
import { getLongChallengeAccumulatedPoints } from "@/lib/actions/long-challenge-points";
import { isTransformationChallenge } from "@/lib/challenge-series";

export async function loadChallengeBracketWithPlatformScores(
  bracket: ChallengeBracketData
): Promise<ChallengeBracketData> {
  if (bracket.participants.length === 0) return bracket;

  if (isTransformationChallenge(bracket.challenge)) {
    const points = await getLongChallengeAccumulatedPoints(bracket.challenge, bracket.participants);
    return enrichBracketWithPlatformScores(bracket, points);
  }

  const scores = await getPlatformEngagementScores(
    bracket.participants.map((participant) => ({
      userId: participant.user_id,
      since: participant.created_at,
    }))
  );
  return enrichBracketWithPlatformScores(bracket, scores);
}
