import { ChallengeOverviewStats } from "@/components/challenge-tournament-visuals";
import type { PlatformCopy } from "@/lib/platform-copy";
import type { Challenge } from "@/lib/types";

export function ChallengeDetailVisuals({
  copy,
  challenge,
  participantCount,
}: {
  copy: PlatformCopy["challenges"];
  challenge: Challenge;
  participantCount: number;
}) {
  return (
    <ChallengeOverviewStats
      copy={copy}
      challenge={challenge}
      participantCount={participantCount}
    />
  );
}
