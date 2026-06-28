"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft, Clock, LogOut, UserPlus } from "lucide-react";
import {
  leaveChallenge,
  leaveChallengeWaitlist,
  registerForChallenge,
} from "@/lib/actions/challenge-bracket";
import { getChallengeEntryFeeCents, getChallengeMaxParticipants, isFlashChallenge } from "@/lib/challenge-series";
import {
  canLeaveChallenge,
  canRegisterForChallenge,
  getChallengeStatus,
  isChallengeAtCapacity,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import { Button } from "@/components/ui/button";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge, UserSeriesChallengeStatus } from "@/lib/types";
import { format } from "date-fns";

type ChallengeJoinActionsProps = {
  challenge: Challenge;
  participantCount: number;
  membership: UserSeriesChallengeStatus;
  /** Render inside prize pool card — full-width primary action. */
  embedded?: boolean;
};

export function ChallengeJoinActions({
  challenge,
  participantCount,
  membership,
  embedded = false,
}: ChallengeJoinActionsProps) {
  const platform = usePlatformCopy();
  const copy = platform.challenges.join;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFlash = isFlashChallenge(challenge);
  const entryFeeLabel = formatEurosFromCents(getChallengeEntryFeeCents(challenge));
  const maxParticipants = getChallengeMaxParticipants(challenge);
  const isFull = isChallengeAtCapacity(challenge, participantCount);
  const canRegister = canRegisterForChallenge(challenge);
  const canLeave = canLeaveChallenge(challenge);
  const challengeStatus = getChallengeStatus(challenge);
  const isRegisteredHere = membership.participant?.challenge_id === challenge.id;
  const isWaitlistedHere = membership.waitlist?.challenge_id === challenge.id;
  const otherChallenge = membership.participant &&
    membership.participant.challenge_id !== challenge.id
    ? membership.participant
    : null;

  const run = (action: () => Promise<{ error?: string; success?: boolean; waitlisted?: boolean }>) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.waitlisted) {
        setMessage(copy.waitlistJoined);
      } else if (result.success) {
        setMessage(copy.successRegistered);
      }
    });
  };

  if (isRegisteredHere) {
    return (
      <div className={embedded ? "space-y-2" : "space-y-2"}>
        <p className="text-sm text-emerald-400">{copy.registeredHere}</p>
        {canLeave ? (
          <Button
            type="button"
            variant={embedded ? "outline" : "outline"}
            disabled={isPending}
            className={embedded ? "w-full" : undefined}
            onClick={() => run(() => leaveChallenge(challenge.id))}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isPending ? copy.leaving : copy.leaveChallenge}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.registrationClosedRegistered}</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (isWaitlistedHere) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-amber-200">
          <Clock className="h-4 w-4 shrink-0" />
          {copy.waitlistPosition.replace(
            "{position}",
            String(membership.waitlist?.position ?? 1)
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          className={embedded ? "w-full" : undefined}
          onClick={() => run(() => leaveChallengeWaitlist(challenge.id))}
        >
          {isPending ? copy.leavingWaitlist : copy.leaveWaitlist}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  const spotsLabel =
    maxParticipants != null
      ? copy.spotsRemaining
          .replace("{remaining}", String(Math.max(0, maxParticipants - participantCount)))
          .replace("{max}", String(maxParticipants))
      : null;

  if (!canRegister) {
    const opensAt = challenge.registration_opens_at
      ? format(new Date(challenge.registration_opens_at), "MMM d, yyyy · h:mm a")
      : null;
    const startsAt = format(new Date(challenge.scheduled_at), "MMM d, yyyy · h:mm a");
    const message =
      opensAt && new Date(challenge.registration_opens_at!) > new Date()
        ? copy.registrationOpensAt.replace("{date}", opensAt)
        : challengeStatus === "upcoming"
          ? copy.registrationJoinWhenLive.replace("{date}", startsAt)
          : copy.registrationClosedAt.replace("{date}", startsAt);

    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {otherChallenge ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {copy.switchNotice.replace("{title}", otherChallenge.challenge_title)}{" "}
          <Link
            href={`/dashboard/challenges/${otherChallenge.challenge_slug}`}
            className="font-semibold underline underline-offset-2"
          >
            {copy.viewCurrent}
          </Link>
        </p>
      ) : null}

      {isFull ? (
        <p className="text-sm text-muted-foreground">
          {isFlash ? copy.flashChallengeFull : copy.challengeFull}
        </p>
      ) : spotsLabel ? (
        <p className="text-sm text-muted-foreground">{spotsLabel}</p>
      ) : null}

      <Button
        type="button"
        disabled={isPending}
        className={embedded ? "w-full" : undefined}
        onClick={() => run(() => registerForChallenge(challenge.id))}
      >
        {otherChallenge ? (
          <ArrowRightLeft className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {isPending
          ? copy.joining
          : isFull
            ? copy.joinWaitlist
            : otherChallenge
              ? copy.switchToThis
              : isFlash
                ? copy.registerWithFee.replace("{fee}", entryFeeLabel)
                : copy.registerFree}
      </Button>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Legacy wrapper for non-transformation challenges. */
export function ChallengeRegisterButton({
  challenge,
  isRegistered,
}: {
  challenge: Challenge;
  isRegistered: boolean;
}) {
  const platform = usePlatformCopy();
  const copy = platform.challenges.join;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isRegistered) return null;

  if (!canRegisterForChallenge(challenge)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await registerForChallenge(challenge.id);
            if (result.error) setError(result.error);
          });
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {isPending ? copy.joining : copy.registerFree}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
