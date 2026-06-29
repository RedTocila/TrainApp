"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Crown, Layers, Sparkles, Trophy, Video } from "lucide-react";
import {
  crownFlashChampionByHighestScore,
  generateFlashGroups,
  markPrizePaid,
  setChampion,
  setFlashGroupWinner,
  startFlashChallenge,
  updateGroupSchedule,
} from "@/lib/actions/challenge-bracket";
import {
  getChallengePrizePoolCents,
  getChallengeStatus,
} from "@/lib/challenge-utils";
import { getChallengeEntryFeeCents } from "@/lib/challenge-series";
import {
  FLASH_MIN_PARTICIPANTS_TO_START,
  flashCanAdminStart,
  flashChallengeHasStarted,
  flashParticipantsNeededToStart,
} from "@/lib/flash-challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import { ChallengeBracketDiagram } from "@/components/challenge-bracket-diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChallengeBracketData, ChallengeBracketGroup } from "@/lib/types";
import { format } from "date-fns";

function GroupScheduleFields({
  group,
  disabled,
}: {
  group: ChallengeBracketGroup;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`schedule-${group.id}`}>Zoom time</Label>
        <Input
          id={`schedule-${group.id}`}
          type="datetime-local"
          defaultValue={
            group.scheduled_at
              ? format(new Date(group.scheduled_at), "yyyy-MM-dd'T'HH:mm")
              : ""
          }
          disabled={disabled || isPending}
          onBlur={(e) => {
            const value = e.target.value;
            const iso = value ? new Date(value).toISOString() : null;
            if (iso === group.scheduled_at) return;
            startTransition(async () => {
              await updateGroupSchedule(group.id, iso, group.zoom_url);
              router.refresh();
            });
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`zoom-${group.id}`}>Zoom link</Label>
        <Input
          id={`zoom-${group.id}`}
          defaultValue={group.zoom_url ?? ""}
          placeholder="https://zoom.us/j/..."
          disabled={disabled || isPending}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value === (group.zoom_url ?? "")) return;
            startTransition(async () => {
              await updateGroupSchedule(group.id, group.scheduled_at, value);
              router.refresh();
            });
          }}
        />
      </div>
    </div>
  );
}

function FlashGroupAdmin({
  group,
  disabled,
  onSaveWinner,
}: {
  group: ChallengeBracketGroup;
  disabled: boolean;
  onSaveWinner: (groupId: string, participantId: string, score: number) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(group.winner_participant_id ?? "");
  const [score, setScore] = useState(
    group.winner?.performance_value != null ? String(group.winner.performance_value) : ""
  );

  return (
    <Card className="border-border">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">
          Group {group.group_number}
          {group.winner ? (
            <span className="ml-2 font-normal text-emerald-300">
              · {group.winner.display_name}
              {typeof group.winner.performance_value === "number"
                ? ` (${group.winner.performance_value})`
                : ""}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {group.members.map((member) => (
            <Button
              key={member.id}
              type="button"
              size="sm"
              variant={selectedId === member.id ? "default" : "outline"}
              disabled={disabled}
              onClick={() => setSelectedId(member.id)}
            >
              {member.display_name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`score-${group.id}`}>Winning record</Label>
            <Input
              id={`score-${group.id}`}
              type="number"
              min={0}
              step="any"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. seconds or reps"
              className="w-40"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            disabled={disabled || !selectedId || score.trim() === ""}
            onClick={() => onSaveWinner(group.id, selectedId, Number(score))}
          >
            <Crown className="mr-1 h-3 w-3" />
            Save group winner
          </Button>
        </div>
        <GroupScheduleFields group={group} disabled={disabled} />
      </CardContent>
    </Card>
  );
}

export function FlashChallengeAdmin({ bracket }: { bracket: ChallengeBracketData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const prizePool = useMemo(
    () =>
      formatEurosFromCents(
        getChallengePrizePoolCents(bracket.challenge, bracket.participants.length)
      ),
    [bracket.challenge, bracket.participants.length]
  );

  const entryFee = formatEurosFromCents(getChallengeEntryFeeCents(bracket.challenge));
  const started = flashChallengeHasStarted(bracket.challenge);
  const needed = flashParticipantsNeededToStart(bracket.participants.length);
  const canStart = flashCanAdminStart(bracket.participants.length);
  const status = getChallengeStatus(bracket.challenge);
  const groupWinners = bracket.round1Groups
    .map((group) => group.winner)
    .filter((winner): winner is NonNullable<typeof winner> => winner != null);

  const refresh = () => router.refresh();

  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">24-hour flash challenge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{bracket.participants.length} / 50 registered</Badge>
            <Badge variant="outline">Prize pool: {prizePool}</Badge>
            <Badge variant="outline">Entry fee: {entryFee}</Badge>
            <Badge variant="outline">Phase {bracket.currentPhase}</Badge>
            <Badge variant={started ? "default" : "outline"}>
              {started
                ? status === "ended"
                  ? "Ended"
                  : "Live"
                : canStart
                  ? "Ready to start"
                  : `Need ${needed} more`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            First {FLASH_MIN_PARTICIPANTS_TO_START} join free — you start the 24h window manually
            once at least {FLASH_MIN_PARTICIPANTS_TO_START} are signed up. After that, new joiners pay{" "}
            {entryFee}. Up to 5 Zoom groups of 10. Enter each group winner&apos;s record, then crown
            the highest score overall.
          </p>
          {!started ? (
            <Button
              type="button"
              disabled={isPending || !canStart}
              onClick={() => run(() => startFlashChallenge(bracket.challenge.id))}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start 24-hour challenge
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zoom groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !started || bracket.participants.length === 0}
            onClick={() => run(() => generateFlashGroups(bracket.challenge.id))}
          >
            <Layers className="mr-2 h-4 w-4" />
            {bracket.round1Groups.length > 0 ? "Rebuild groups by join order" : "Create groups"}
          </Button>

          {bracket.round1Groups.map((group) => (
            <FlashGroupAdmin
              key={group.id}
              group={group}
              disabled={isPending}
              onSaveWinner={async (groupId, participantId, performanceValue) => {
                await setFlashGroupWinner(groupId, participantId, performanceValue);
              }}
            />
          ))}
        </CardContent>
      </Card>

      {groupWinners.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group winners · final champion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {[...groupWinners]
                .sort((a, b) => (b.performance_value ?? -1) - (a.performance_value ?? -1))
                .map((winner) => (
                  <li
                    key={winner.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="font-medium">{winner.display_name}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {typeof winner.performance_value === "number"
                        ? winner.performance_value
                        : "No score"}
                    </Badge>
                    {winner.status !== "champion" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => run(() => setChampion(winner.id))}
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        Crown
                      </Button>
                    ) : (
                      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
                        Champion
                      </Badge>
                    )}
                  </li>
                ))}
            </ul>
            <Button
              type="button"
              disabled={isPending || !!bracket.champion}
              onClick={() => run(() => crownFlashChampionByHighestScore(bracket.challenge.id))}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Crown highest record automatically
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {bracket.champion ? (
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
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Client preview</p>
        <ChallengeBracketDiagram bracket={bracket} adminMode variant="zoomGroups" />
      </div>
    </div>
  );
}
