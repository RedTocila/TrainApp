"use server";

import type { ChallengeBracketData } from "@/lib/types";
import { enrichBracketWithPlatformScores } from "@/lib/challenge-platform-scores";
import { getPlatformEngagementScores } from "@/lib/actions/platform-engagement-score";

export async function loadChallengeBracketWithPlatformScores(
  bracket: ChallengeBracketData
): Promise<ChallengeBracketData> {
  if (bracket.participants.length === 0) return bracket;

  const scores = await getPlatformEngagementScores(
    bracket.participants.map((participant) => ({
      userId: participant.user_id,
      since: participant.created_at,
    }))
  );

  return enrichBracketWithPlatformScores(bracket, scores);
}
