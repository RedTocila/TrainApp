import type {
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
} from "@/lib/types";

export type PlatformScoredParticipant = {
  platform_score?: number;
  display_name: string;
};

export function compareParticipantsByPlatformScore(
  a: PlatformScoredParticipant,
  b: PlatformScoredParticipant
): number {
  const scoreA = a.platform_score ?? -1;
  const scoreB = b.platform_score ?? -1;
  if (scoreB !== scoreA) return scoreB - scoreA;
  return a.display_name.localeCompare(b.display_name);
}

export function sortParticipantsByPlatformScore<T extends PlatformScoredParticipant>(
  participants: T[]
): T[] {
  return [...participants].sort(compareParticipantsByPlatformScore);
}

export function buildParticipantRankMap(
  participants: Pick<ChallengeBracketParticipant, "id">[]
): Map<string, number> {
  const sorted = sortParticipantsByPlatformScore(
    participants as ChallengeBracketParticipant[]
  );
  return new Map(sorted.map((participant, index) => [participant.id, index + 1]));
}

function sortGroupMembers<T extends ChallengeBracketGroup>(group: T): T {
  return {
    ...group,
    members: sortParticipantsByPlatformScore(group.members),
    winner: group.winner,
  };
}

export function sortBracketByPlatformScore(
  bracket: ChallengeBracketData
): ChallengeBracketData {
  const participants = sortParticipantsByPlatformScore(bracket.participants);

  return {
    ...bracket,
    participants,
    round1Groups: bracket.round1Groups.map(sortGroupMembers),
    round2Groups: bracket.round2Groups.map(sortGroupMembers),
    round3Group: bracket.round3Group ? sortGroupMembers(bracket.round3Group) : null,
    groupStage: bracket.round1Groups.map(sortGroupMembers),
    finalRound: bracket.round3Group ? sortGroupMembers(bracket.round3Group) : null,
  };
}

/** Participant ids highest score first — used when drawing Round 1 groups. */
export function participantIdsByPlatformScore(
  participants: { id: string; user_id: string; created_at: string }[],
  scoresByUserId: Record<string, number>
): string[] {
  return [...participants]
    .sort((a, b) => {
      const scoreA = scoresByUserId[a.user_id] ?? -1;
      const scoreB = scoresByUserId[b.user_id] ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.created_at.localeCompare(b.created_at);
    })
    .map((participant) => participant.id);
}
