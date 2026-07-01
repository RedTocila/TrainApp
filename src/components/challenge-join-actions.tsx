"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Clock, LogOut, UserPlus } from "lucide-react";
import {
  leaveChallenge,
  leaveChallengeWaitlist,
  registerForChallenge,
} from "@/lib/actions/challenge-bracket";
import { createFlashChallengeEntryCheckout } from "@/lib/actions/flash-challenge-checkout";
import { getChallengeEntryFeeCents, getChallengeMaxParticipants, isFlashChallenge, isTransformationChallenge } from "@/lib/challenge-series";
import {
  flashFirstGroupIsFull,
  flashGroupSize,
  flashParticipantNeedsPayment,
  flashRequiresPaymentOnJoin,
  flashSeatIsFreeOnJoin,
} from "@/lib/flash-challenge-entry-fee";
import {
  flashCanAdminStart,
  flashChallengeHasStarted,
  flashParticipantsNeededToStart,
} from "@/lib/flash-challenge-utils";
import {
  canLeaveChallenge,
  canRegisterForChallenge,
  getChallengePhase,
  getChallengeStatus,
  isChallengeAtCapacity,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import { Button } from "@/components/ui/button";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge, ChallengeParticipant, UserSeriesChallengeStatus } from "@/lib/types";
import { format } from "date-fns";

type ChallengeJoinActionsProps = {
  challenge: Challenge;
  participantCount: number;
  membership: UserSeriesChallengeStatus;
  /** Current user's participant row on this challenge (flash payment state). */
  currentParticipant?: ChallengeParticipant | null;
  /** All participants on this challenge (flash first-group payment checks). */
  allParticipants?: ChallengeParticipant[];
  /** Render inside prize pool card — full-width primary action. */
  embedded?: boolean;
};

export function ChallengeJoinActions({
  challenge,
  participantCount,
  membership,
  currentParticipant = null,
  allParticipants = [],
  embedded = false,
}: ChallengeJoinActionsProps) {
  const platform = usePlatformCopy();
  const copy = platform.challenges.join;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFlash = isFlashChallenge(challenge);
  const isTransformation = isTransformationChallenge(challenge);
  const entryFeeLabel = formatEurosFromCents(getChallengeEntryFeeCents(challenge));
  const maxParticipants = getChallengeMaxParticipants(challenge);
  const isFull = isChallengeAtCapacity(challenge, participantCount);
  const canRegister = canRegisterForChallenge(challenge);
  const canLeave = canLeaveChallenge(challenge);
  const challengeStatus = getChallengeStatus(challenge);
  const isRegisteredHere =
    membership.participant?.challenge_id === challenge.id || currentParticipant != null;
  const isWaitlistedHere = membership.waitlist?.challenge_id === challenge.id;
  const otherChallenge = membership.participant &&
    membership.participant.challenge_id !== challenge.id
    ? membership.participant
    : null;
  const otherWaitlist = membership.waitlist &&
    membership.waitlist.challenge_id !== challenge.id
    ? membership.waitlist
    : null;
  const blockedByOtherLongChallenge =
    isTransformation &&
    !isRegisteredHere &&
    (otherChallenge != null || otherWaitlist != null);
  const showOtherFlashNotice =
    isFlash && otherChallenge != null && !isRegisteredHere;
  const blockedChallengeTitle =
    otherChallenge?.challenge_title ?? otherWaitlist?.challenge_title ?? "";
  const blockedChallengeSlug =
    otherChallenge?.challenge_slug ?? otherWaitlist?.challenge_slug ?? "";

  const groupSize = flashGroupSize(challenge);
  const paymentRequiredOnJoin = isFlash && flashRequiresPaymentOnJoin(participantCount, groupSize);
  const freeSeatAvailable = isFlash && flashSeatIsFreeOnJoin(participantCount, groupSize);
  const needsPaymentToContinue =
    isFlash &&
    currentParticipant != null &&
    flashParticipantNeedsPayment(currentParticipant, allParticipants, groupSize);
  const firstGroupFull = isFlash && flashFirstGroupIsFull(participantCount, groupSize);
  const flashStarted = isFlash && flashChallengeHasStarted(challenge);
  const flashNeeded = isFlash ? flashParticipantsNeededToStart(participantCount) : 0;
  const flashReadyToStart = isFlash && flashCanAdminStart(participantCount) && !flashStarted;

  const startFlashCheckout = (action: "join" | "confirm") => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createFlashChallengeEntryCheckout(challenge.id, action);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        router.push(result.checkoutUrl);
      }
    });
  };

  const run = (
    action: () => Promise<{ error?: string; success?: boolean; waitlisted?: boolean }>,
    successMessage?: string
  ) => {
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
        setMessage(successMessage ?? copy.successRegistered);
      }
      router.refresh();
    });
  };

  if (isRegisteredHere) {
    const showLeaveBeforePay =
      isFlash &&
      currentParticipant &&
      !currentParticipant.entry_fee_paid_at &&
      !flashStarted;

    return (
      <div className={embedded ? "space-y-2" : "space-y-2"}>
        {showLeaveBeforePay ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            className={embedded ? "w-full" : undefined}
            onClick={() => run(() => leaveChallenge(challenge.id), copy.successLeft)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isPending ? copy.leaving : copy.leaveChallenge}
          </Button>
        ) : null}
        {needsPaymentToContinue ? (
          <>
            <p className="text-sm text-amber-200">
              {copy.flashFirstGroupPayNotice
                .replace("{fee}", entryFeeLabel)
                .replace("{count}", String(groupSize))}
            </p>
            <Button
              type="button"
              disabled={isPending}
              className={embedded ? "w-full" : undefined}
              onClick={() => startFlashCheckout("confirm")}
            >
              {isPending
                ? copy.joining
                : copy.payEntryFee.replace("{fee}", entryFeeLabel)}
            </Button>
          </>
        ) : isFlash && currentParticipant && !currentParticipant.entry_fee_paid_at && !firstGroupFull ? (
          <p className="text-sm text-emerald-400">
            {copy.flashSeatReserved.replace("{count}", String(groupSize))}
          </p>
        ) : (
          <p className="text-sm text-emerald-400">{copy.registeredHere}</p>
        )}
        {canLeave && !showLeaveBeforePay ? (
          <Button
            type="button"
            variant={embedded ? "outline" : "outline"}
            disabled={isPending}
            className={embedded ? "w-full" : undefined}
            onClick={() => run(() => leaveChallenge(challenge.id), copy.successLeft)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isPending ? copy.leaving : copy.leaveChallenge}
          </Button>
        ) : !showLeaveBeforePay && !canLeave ? (
          <p className="text-sm text-muted-foreground">
            {getChallengePhase(challenge) > 0
              ? copy.leaveLockedTournamentStarted
              : copy.registrationClosedRegistered}
          </p>
        ) : null}
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
      {blockedByOtherLongChallenge ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {copy.activeLongChallengeBlocksJoin.replace("{title}", blockedChallengeTitle)}{" "}
          <Link
            href={`/dashboard/challenges/${blockedChallengeSlug}`}
            className="font-semibold underline underline-offset-2"
          >
            {copy.viewCurrent}
          </Link>
        </p>
      ) : showOtherFlashNotice ? (
        <p className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
          You are also registered for{" "}
          <Link
            href={`/dashboard/challenges/${otherChallenge.challenge_slug}`}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            {otherChallenge.challenge_title}
          </Link>
          . You can join multiple flash challenges.
        </p>
      ) : otherChallenge && !isFlash ? (
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

      {isFlash && !flashStarted && flashNeeded > 0 ? (
        <p className="text-sm text-amber-200">
          {copy.flashFillingNotice.replace("{count}", String(flashNeeded))}
        </p>
      ) : null}

      {isFlash && flashReadyToStart ? (
        <p className="text-sm text-amber-200">{copy.flashWaitingToStart}</p>
      ) : null}

      {!blockedByOtherLongChallenge ? (
        <Button
          type="button"
          disabled={isPending}
          className={embedded ? "w-full" : undefined}
          onClick={() =>
            paymentRequiredOnJoin
              ? startFlashCheckout("join")
              : run(() => registerForChallenge(challenge.id))
          }
        >
          {otherChallenge && !isFlash ? (
            <ArrowRightLeft className="mr-2 h-4 w-4" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {isPending
            ? copy.joining
            : isFull
              ? copy.joinWaitlist
              : otherChallenge && !isFlash
                ? copy.switchToThis
                : isFlash
                  ? paymentRequiredOnJoin
                    ? copy.registerWithFee.replace("{fee}", entryFeeLabel)
                    : freeSeatAvailable
                      ? copy.reserveFreeSeat.replace("{count}", String(groupSize))
                      : copy.registerWithFee.replace("{fee}", entryFeeLabel)
                  : copy.registerFree}
        </Button>
      ) : null}

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canRegister = canRegisterForChallenge(challenge);
  const canLeave = canLeaveChallenge(challenge);

  if (isRegistered) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-emerald-400">{copy.registeredHere}</p>
        {canLeave ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await leaveChallenge(challenge.id);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isPending ? copy.leaving : copy.leaveChallenge}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {getChallengePhase(challenge) > 0
              ? copy.leaveLockedTournamentStarted
              : copy.registrationClosedRegistered}
          </p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (!canRegister) {
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
            else router.refresh();
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
