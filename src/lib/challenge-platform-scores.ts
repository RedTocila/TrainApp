import type { ChallengeBracketData } from "@/lib/types";
import type { PlatformScoreEntry } from "@/lib/platform-engagement-score";
import { sortBracketByPlatformScore } from "@/lib/challenge-participant-ranking";

export function enrichBracketWithPlatformScores(
  bracket: ChallengeBracketData,
  scoresByUserId: Record<string, PlatformScoreEntry | number>
): ChallengeBracketData {
  const resolveScore = (userId: string) => {
    const entry = scoresByUserId[userId];
    if (entry == null) return { score: undefined, breakdown: undefined };
    if (typeof entry === "number") return { score: entry, breakdown: undefined };
    return { score: entry.score, breakdown: entry.breakdown };
  };

  const withScore = <
    T extends {
      user_id: string;
      platform_score?: number;
      platform_score_breakdown?: PlatformScoreEntry["breakdown"];
    },
  >(
    participant: T
  ): T => {
    const { score, breakdown } = resolveScore(participant.user_id);
    return {
      ...participant,
      platform_score: score,
      platform_score_breakdown: breakdown,
    };
  };

  const enriched: ChallengeBracketData = {
    ...bracket,
    participants: bracket.participants.map(withScore),
    round1Groups: bracket.round1Groups.map((group) => ({
      ...group,
      members: group.members.map(withScore),
      winner: group.winner ? withScore(group.winner) : null,
    })),
    round2Groups: bracket.round2Groups.map((group) => ({
      ...group,
      members: group.members.map(withScore),
      winner: group.winner ? withScore(group.winner) : null,
    })),
    round3Group: bracket.round3Group
      ? {
          ...bracket.round3Group,
          members: bracket.round3Group.members.map(withScore),
          winner: bracket.round3Group.winner
            ? withScore(bracket.round3Group.winner)
            : null,
        }
      : null,
    champion: bracket.champion ? withScore(bracket.champion) : null,
    groupStage: bracket.round1Groups.map((group) => ({
      ...group,
      members: group.members.map(withScore),
      winner: group.winner ? withScore(group.winner) : null,
    })),
    finalRound: bracket.round3Group
      ? {
          ...bracket.round3Group,
          members: bracket.round3Group.members.map(withScore),
          winner: bracket.round3Group.winner
            ? withScore(bracket.round3Group.winner)
            : null,
        }
      : null,
  };

  return sortBracketByPlatformScore(enriched);
}
