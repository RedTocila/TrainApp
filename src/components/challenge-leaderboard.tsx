"use client";

import { Crown, Trophy, User } from "lucide-react";
import { ParticipantPlatformScoreBadge } from "@/components/participant-platform-score-badge";
import { usePlatformCopy } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildParticipantRankMap,
  sortParticipantsByPlatformScore,
} from "@/lib/challenge-participant-ranking";
import { getChallengeDurationDays, getChallengeDurationMonths } from "@/lib/challenge-utils";
import type { Challenge, ChallengeParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

function participantPoints(participant: ChallengeParticipant): number | null {
  if (typeof participant.challenge_points === "number") return participant.challenge_points;
  if (typeof participant.platform_score === "number") return participant.platform_score;
  return null;
}

function maxPossiblePoints(challenge: Challenge): number | null {
  const days = getChallengeDurationDays(challenge);
  if (days != null && days > 0) return days * 100;
  const months = getChallengeDurationMonths(challenge);
  if (months > 0) return months * 30 * 100;
  return null;
}

export function ChallengeLeaderboard({
  challenge,
  participants,
  currentUserParticipantId,
  compact = false,
}: {
  challenge: Challenge;
  participants: ChallengeParticipant[];
  currentUserParticipantId?: string | null;
  compact?: boolean;
}) {
  const copy = usePlatformCopy().challenges;
  const sorted = sortParticipantsByPlatformScore(participants);
  const rankById = buildParticipantRankMap(participants);
  const champion = participants.find((p) => p.status === "champion") ?? null;
  const maxPts = maxPossiblePoints(challenge);

  if (participants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {copy.leaderboardEmpty}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {champion ? (
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/25">
            <Trophy className="h-7 w-7 text-amber-300" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-200/90">
            {copy.championLabel}
          </p>
          <p className="mt-1 text-xl font-black">{champion.display_name}</p>
          {participantPoints(champion) != null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {participantPoints(champion)} {copy.pointsUnit}
            </p>
          ) : null}
        </section>
      ) : null}

      <Card>
        <CardHeader className={cn("pb-3", compact && "px-4 pt-4")}>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {copy.leaderboardTitle}
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {participants.length}
              {challenge.max_participants != null ? ` / ${challenge.max_participants}` : ""}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{copy.leaderboardIntro}</p>
          {maxPts != null ? (
            <p className="text-xs text-muted-foreground">
              {copy.leaderboardMaxPoints.replace("{max}", String(maxPts))}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className={cn(compact && "px-4 pb-4")}>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {sorted.map((participant) => {
              const rank = rankById.get(participant.id);
              const pts = participantPoints(participant);
              const isYou = participant.id === currentUserParticipantId;
              const isFinalist = participant.status === "finalist";
              const isChampion = participant.status === "champion";

              return (
                <li
                  key={participant.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm",
                    isYou && "bg-primary/5",
                    isFinalist && "bg-violet-500/5"
                  )}
                >
                  <span className="w-8 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                    {rank != null ? `#${rank}` : "—"}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {isChampion ? (
                      <Crown className="h-4 w-4 text-amber-300" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{participant.display_name}</p>
                    {isFinalist ? (
                      <p className="text-[10px] font-medium text-violet-300">
                        {copy.judgmentDayInviteLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {pts != null ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {pts} {copy.pointsUnit}
                      </Badge>
                    ) : typeof participant.platform_score === "number" ? (
                      <ParticipantPlatformScoreBadge
                        score={participant.platform_score}
                        breakdown={participant.platform_score_breakdown}
                      />
                    ) : null}
                    {isYou ? (
                      <Badge variant="outline" className="text-[10px]">
                        You
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
