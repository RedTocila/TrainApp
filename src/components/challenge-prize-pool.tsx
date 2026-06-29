"use client";

import type { ReactNode } from "react";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getChallengePrizePoolCents,
  getMaxChallengePrizePoolCents,
  getPrizePoolCentsPerParticipant,
  getPrizePoolMonthsActive,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import {
  getChallengeEntryFeeCents,
  getChallengeMaxParticipants,
  isFlashChallenge,
} from "@/lib/challenge-series";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChallengePrizePoolProps = {
  challenge: Pick<
    Challenge,
    | "prize_pool_cents_per_participant"
    | "scheduled_at"
    | "slug"
    | "is_flash"
    | "is_transformation"
    | "entry_fee_cents"
    | "duration_days"
    | "duration_months"
    | "max_participants"
  >;
  participantCount: number;
  variant?: "panel" | "compact" | "hero" | "catalog";
  /** Larger hero text (flash catalog cards). */
  heroSize?: "default" | "lg";
  /** Catalog cards: show full-capacity max prize instead of current pool. */
  prizeMode?: "current" | "max";
  /** Hide per-participant pool increment (flash challenges). */
  hidePoolBreakdown?: boolean;
  footer?: ReactNode;
  /** Light text for hero cards on dark gradient backgrounds */
  tone?: "default" | "onGradient";
  className?: string;
};

export function ChallengePrizePool({
  challenge,
  participantCount,
  variant = "panel",
  heroSize = "default",
  prizeMode = "current",
  hidePoolBreakdown = false,
  footer,
  tone = "default",
  className,
}: ChallengePrizePoolProps) {
  const platform = usePlatformCopy();
  const copy = platform.challenges.prizePool;
  const centsPerParticipant = getPrizePoolCentsPerParticipant(challenge);
  const poolCents =
    prizeMode === "max"
      ? getMaxChallengePrizePoolCents(challenge)
      : getChallengePrizePoolCents(challenge, participantCount);
  const monthsActive = getPrizePoolMonthsActive(challenge);
  const perPersonLabel = formatEurosFromCents(centsPerParticipant);
  const poolLabel = formatEurosFromCents(poolCents);
  const showMax = prizeMode === "max";
  const entryFeeCents = getChallengeEntryFeeCents(challenge);
  const entryFeeLabel = formatEurosFromCents(entryFeeCents);
  const isFlash = isFlashChallenge(challenge);
  const monthlyGrowthNote = isFlash
    ? copy.flashPoolNote
    : monthsActive > 1
      ? copy.monthlyPoolGrowthActive
          .replace("{month}", String(monthsActive))
          .replace("{amount}", perPersonLabel)
          .replace("{count}", String(participantCount))
      : copy.monthlyPoolGrowth;

  if (variant === "compact") {
    const maxParticipants = getChallengeMaxParticipants(challenge);
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-amber-500/35 bg-amber-500/10 text-amber-200",
          className
        )}
        title={
          showMax && maxParticipants != null
            ? copy.cardMaxPoolHint
                .replace("{pool}", poolLabel)
                .replace("{max}", String(maxParticipants))
            : undefined
        }
      >
        <Trophy className="mr-1 h-3 w-3" />
        {showMax && maxParticipants != null
          ? copy.compactMaxPoolHint
              .replace("{pool}", poolLabel)
              .replace("{max}", String(maxParticipants))
          : showMax
            ? copy.compactWinUpTo.replace("{pool}", poolLabel)
            : copy.compactPool.replace("{pool}", poolLabel)}
      </Badge>
    );
  }

  if (variant === "catalog") {
    const onGradient = tone === "onGradient";
    const maxParticipants = getChallengeMaxParticipants(challenge);
    const poolCentsMax = getMaxChallengePrizePoolCents(challenge);
    const maxPoolLabel = formatEurosFromCents(poolCentsMax);

    return (
      <div
        className={cn(
          "inline-flex w-fit max-w-full flex-col gap-1 rounded-xl border px-4 py-3",
          onGradient
            ? "border-white/25 bg-black/25 text-white backdrop-blur-sm"
            : "border-amber-500/30 bg-amber-500/10 text-amber-50",
          className
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
            onGradient ? "text-white/85" : "text-amber-200/90"
          )}
        >
          <Trophy className="h-3.5 w-3.5" />
          {copy.maxPrizeLabel}
        </span>
        {maxParticipants != null ? (
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              onGradient ? "text-yellow-300" : "text-yellow-400"
            )}
          >
            {copy.catalogWinUpToLine
              .replace("{pool}", maxPoolLabel)
              .replace("{max}", String(maxParticipants))}
          </p>
        ) : (
          <p className="text-sm font-medium text-yellow-300">{maxPoolLabel}</p>
        )}
      </div>
    );
  }

  if (variant === "hero") {
    const onGradient = tone === "onGradient";
    const prominent = heroSize === "lg";
    const maxParticipants = getChallengeMaxParticipants(challenge);

    return (
      <div
        className={cn(
          "inline-flex flex-col rounded-xl border",
          prominent ? "gap-1.5 px-5 py-4" : "gap-1 px-4 py-3",
          onGradient
            ? "border-white/25 bg-black/25 text-white backdrop-blur-sm"
            : "border-amber-500/30 bg-amber-500/10 text-amber-50",
          className
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 font-semibold uppercase tracking-wider",
            prominent ? "text-sm" : "text-xs",
            onGradient ? "text-white/85" : "text-amber-200/90"
          )}
        >
          <Trophy className={cn(prominent ? "h-4 w-4" : "h-3.5 w-3.5")} />
          {showMax ? copy.maxPrizeLabel : copy.grandPrize}
        </span>
        <span
          className={cn(
            "font-black tabular-nums leading-none tracking-tight",
            prominent ? "text-3xl sm:text-4xl" : "text-2xl"
          )}
        >
          {poolLabel}
        </span>
        {showMax && maxParticipants != null ? (
          <span
            className={cn(
              "max-w-sm text-xs leading-snug sm:text-sm",
              onGradient ? "text-white/80" : "text-amber-100/85"
            )}
          >
            {copy.cardMaxPoolHint
              .replace("{pool}", poolLabel)
              .replace("{max}", String(maxParticipants))}
          </span>
        ) : null}
        {!hidePoolBreakdown && !showMax ? (
          <span className={cn("text-xs", onGradient ? "text-white/75" : "text-amber-100/80")}>
            {copy.perParticipant
              .replace("{amount}", perPersonLabel)
              .replace("{count}", String(participantCount))
              .replace("{month}", String(monthsActive))}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={cn("border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card", className)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Trophy className="h-4 w-4" />
              {copy.grandPrize}
            </p>
            <p className="text-3xl font-black tabular-nums text-amber-50">{poolLabel}</p>
            <p className="text-sm text-muted-foreground">{copy.championTakesAll}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
              {entryFeeCents > 0 ? copy.entryFee : copy.perEntry}
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-100">
              {entryFeeCents > 0 ? entryFeeLabel : `+${perPersonLabel}`}
            </p>
          </div>
        </div>

        {!hidePoolBreakdown ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-300" />
              {copy.participants.replace("{count}", String(participantCount))}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
              {monthlyGrowthNote}
            </span>
          </div>
        ) : null}

        {footer ? (
          <div className="border-t border-amber-500/20 pt-4">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
