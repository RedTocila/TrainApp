"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play, Sparkles } from "lucide-react";
import { startChallenge } from "@/lib/actions/challenge-bracket";
import {
  canAdminStartChallenge,
  challengeHasStarted,
  MIN_PARTICIPANTS_TO_START,
  participantsNeededToStart,
} from "@/lib/challenge-utils";
import { isFlashChallenge } from "@/lib/challenge-series";
import type { Challenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartChallengeButton({
  challenge,
  participantCount,
  className,
  size = "sm",
  fullWidth = false,
}: {
  challenge: Pick<Challenge, "id" | "current_phase" | "is_flash" | "slug">;
  participantCount: number;
  className?: string;
  size?: "sm" | "default" | "lg";
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (challengeHasStarted(challenge)) return null;

  const canStart = canAdminStartChallenge(participantCount);
  const needed = participantsNeededToStart(participantCount);
  const flash = isFlashChallenge(challenge);

  return (
    <div className={cn(fullWidth && "w-full", className)}>
      <Button
        type="button"
        size={size}
        className={cn(fullWidth && "w-full")}
        disabled={isPending || !canStart}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await startChallenge(challenge.id);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not start challenge.");
            }
          });
        }}
      >
        {flash ? (
          <Sparkles className="mr-2 h-4 w-4" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {canStart
          ? flash
            ? "Start 24-hour challenge"
            : "Start challenge"
          : `Need ${needed} more (min ${MIN_PARTICIPANTS_TO_START})`}
      </Button>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
