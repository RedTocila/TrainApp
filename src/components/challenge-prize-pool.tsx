"use client";

import { Trophy, TrendingUp, Users } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getChallengePrizePoolCents,
  getPrizePoolCentsPerParticipant,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/referral-credits";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChallengePrizePoolProps = {
  challenge: Pick<Challenge, "prize_pool_cents_per_participant">;
  participantCount: number;
  variant?: "panel" | "compact" | "hero";
  className?: string;
};

export function ChallengePrizePool({
  challenge,
  participantCount,
  variant = "panel",
  className,
}: ChallengePrizePoolProps) {
  const platform = usePlatformCopy();
  const copy = platform.challenges.prizePool;
  const centsPerParticipant = getPrizePoolCentsPerParticipant(challenge);
  const poolCents = getChallengePrizePoolCents(challenge, participantCount);
  const perPersonLabel = formatEurosFromCents(centsPerParticipant);
  const poolLabel = formatEurosFromCents(poolCents);

  if (variant === "compact") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-amber-500/35 bg-amber-500/10 text-amber-200",
          className
        )}
      >
        <Trophy className="mr-1 h-3 w-3" />
        {copy.compactPool.replace("{pool}", poolLabel)}
      </Badge>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "inline-flex flex-col gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-50",
          className
        )}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          <Trophy className="h-3.5 w-3.5" />
          {copy.grandPrize}
        </span>
        <span className="text-2xl font-black tabular-nums">{poolLabel}</span>
        <span className="text-xs text-amber-100/80">
          {copy.perParticipant
            .replace("{amount}", perPersonLabel)
            .replace("{count}", String(participantCount))}
        </span>
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
              {copy.perEntry}
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-100">+{perPersonLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-300" />
            {copy.participants.replace("{count}", String(participantCount))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
            {copy.growsWithSignups}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
