"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { Crown, Trophy, UserCheck, UserX, Video } from "lucide-react";
import {
  markPrizePaid,
  setChampion,
  setJudgmentDayInvite,
  updateJudgmentDaySchedule,
} from "@/lib/actions/challenge-bracket";
import {
  getChallengePrizePoolCents,
  getPrizePoolCentsPerParticipant,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import { ChallengeLeaderboard } from "@/components/challenge-leaderboard";
import { ParticipantPlatformScoreBadge } from "@/components/participant-platform-score-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChallengeBracketData } from "@/lib/types";
import {
  buildParticipantRankMap,
  sortParticipantsByPlatformScore,
} from "@/lib/challenge-participant-ranking";
import { cn } from "@/lib/utils";

export function ChallengeLongChallengeAdmin({ bracket }: { bracket: ChallengeBracketData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [finalZoom, setFinalZoom] = useState(bracket.challenge.final_zoom_url ?? "");
  const [judgmentAt, setJudgmentAt] = useState(
    bracket.challenge.round_3_zoom_at
      ? format(new Date(bracket.challenge.round_3_zoom_at), "yyyy-MM-dd'T'HH:mm")
      : ""
  );

  const prizePool = formatEurosFromCents(
    getChallengePrizePoolCents(bracket.challenge, bracket.participants.length)
  );
  const perEntry = formatEurosFromCents(
    getPrizePoolCentsPerParticipant(bracket.challenge)
  );
  const phase = bracket.currentPhase;

  const sorted = useMemo(
    () => sortParticipantsByPlatformScore(bracket.participants),
    [bracket.participants]
  );
  const rankById = useMemo(
    () => buildParticipantRankMap(bracket.participants),
    [bracket.participants]
  );

  const refresh = () => router.refresh();

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{bracket.participants.length} registered</Badge>
            <Badge variant="outline">Prize pool: {prizePool}</Badge>
            <Badge variant="outline">+{perEntry}/entrant (display only)</Badge>
            <Badge variant="outline">Phase {phase}</Badge>
            {bracket.challenge.prize_paid_at && (
              <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                Prize paid
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Daily 0–100 points accumulate from join date (50% nutrition · 30% workouts · 20%
            habits + water). Invite top scorers to judgment-day Zoom, then crown the winner
            manually.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Judgment day Zoom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="judgment-at">Date & time</Label>
              <Input
                id="judgment-at"
                type="datetime-local"
                value={judgmentAt}
                onChange={(e) => setJudgmentAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="judgment-zoom">Zoom link</Label>
              <Input
                id="judgment-zoom"
                value={finalZoom}
                onChange={(e) => setFinalZoom(e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(() =>
                updateJudgmentDaySchedule(
                  bracket.challenge.id,
                  judgmentAt ? new Date(judgmentAt).toISOString() : null,
                  finalZoom.trim() || null
                )
              )
            }
          >
            <Video className="mr-2 h-4 w-4" />
            Save judgment day
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite to judgment day</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toggle who gets the Zoom link. Pick based on points — typically the highest scorers.
          </p>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {sorted.map((participant) => {
              const rank = rankById.get(participant.id);
              const pts =
                typeof participant.challenge_points === "number"
                  ? participant.challenge_points
                  : participant.platform_score;
              const invited = participant.status === "finalist";
              const isChampion = participant.status === "champion";

              return (
                <li
                  key={participant.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
                >
                  <span className="w-8 text-center text-xs font-bold text-muted-foreground">
                    #{rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {participant.display_name}
                  </span>
                  {typeof pts === "number" ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {pts} pts
                    </Badge>
                  ) : typeof participant.platform_score === "number" ? (
                    <ParticipantPlatformScoreBadge
                      score={participant.platform_score}
                      breakdown={participant.platform_score_breakdown}
                    />
                  ) : null}
                  {isChampion ? (
                    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
                      Champion
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={invited ? "default" : "outline"}
                      disabled={isPending}
                      className={cn(invited && "bg-violet-600 hover:bg-violet-600/90")}
                      onClick={() =>
                        run(() => setJudgmentDayInvite(participant.id, !invited))
                      }
                    >
                      {invited ? (
                        <>
                          <UserCheck className="mr-1 h-3 w-3" />
                          Invited
                        </>
                      ) : (
                        <>
                          <UserX className="mr-1 h-3 w-3" />
                          Invite
                        </>
                      )}
                    </Button>
                  )}
                  {!isChampion ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => run(() => setChampion(participant.id))}
                    >
                      <Crown className="mr-1 h-3 w-3" />
                      Crown
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {bracket.champion && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-400" />
              Champion: {bracket.champion.display_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prize pool: <strong className="text-foreground">{prizePool}</strong> — send manually,
              then mark paid below.
            </p>
            <Button
              type="button"
              disabled={isPending || !!bracket.challenge.prize_paid_at}
              onClick={() => run(() => markPrizePaid(bracket.challenge.id))}
            >
              <Video className="mr-2 h-4 w-4" />
              {bracket.challenge.prize_paid_at ? "Prize marked paid" : "Mark prize paid"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Leaderboard preview</p>
        <ChallengeLeaderboard
          challenge={bracket.challenge}
          participants={bracket.participants}
          currentUserParticipantId={bracket.currentUserParticipantId}
        />
      </div>
    </div>
  );
}
