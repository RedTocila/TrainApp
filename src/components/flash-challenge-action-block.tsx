"use client";

import { ExternalLink, Video } from "lucide-react";
import { ChallengeJoinActions } from "@/components/challenge-join-actions";
import { ChallengePrizePool } from "@/components/challenge-prize-pool";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge, ChallengeParticipant, UserSeriesChallengeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FlashChallengeActionBlock({
  challenge,
  participantCount,
  membership,
  showJoin,
  zoomUrl,
  currentParticipant = null,
  allParticipants = [],
}: {
  challenge: Challenge;
  participantCount: number;
  membership: UserSeriesChallengeStatus;
  showJoin: boolean;
  zoomUrl: string | null;
  currentParticipant?: ChallengeParticipant | null;
  allParticipants?: ChallengeParticipant[];
}) {
  const copy = usePlatformCopy().challenges.flash;

  return (
    <div className="space-y-3">
      <ChallengePrizePool
        challenge={challenge}
        participantCount={participantCount}
        hidePoolBreakdown
        footer={
          showJoin ? (
            <ChallengeJoinActions
              challenge={challenge}
              participantCount={participantCount}
              membership={membership}
              currentParticipant={currentParticipant}
              allParticipants={allParticipants}
              embedded
            />
          ) : null
        }
      />

      {zoomUrl ? (
        <a
          href={zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg" }),
            "flex w-full items-center justify-center gap-2 border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 hover:text-white"
          )}
        >
          <Video className="h-5 w-5" />
          {copy.joinZoomButton}
          <ExternalLink className="h-4 w-4 opacity-70" />
        </a>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled
          className="w-full border-violet-500/30 bg-violet-500/10 text-violet-200/80"
        >
          <Video className="mr-2 h-5 w-5" />
          {copy.zoomLinkPending}
        </Button>
      )}
    </div>
  );
}
