"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Crown, Layers, Sparkles, Trophy, Video } from "lucide-react";
import {
  createChampionFinal,
  generateRound1Groups,
  generateRound2Groups,
  markPrizePaid,
  setChampion,
  setRound1Advancers,
  setRound2GroupWinner,
  updateFinalZoomUrl,
  updateGroupSchedule,
} from "@/lib/actions/challenge-bracket";
import {
  getChallengePrizePoolCents,
  getPrizePoolCentsPerParticipant,
  isRound1Complete,
  isRound2Complete,
  ROUND1_ADVANCE_COUNT,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/referral-credits";
import { ChallengeBracketDiagram } from "@/components/challenge-bracket-diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChallengeBracketData, ChallengeBracketGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

function Round1GroupAdmin({
  group,
  disabled,
  onConfirm,
}: {
  group: ChallengeBracketGroup;
  disabled: boolean;
  onConfirm: (groupId: string, ids: string[]) => Promise<void>;
}) {
  const advancedIds = group.members.filter((m) => m.outcome === "advanced").map((m) => m.id);
  const [selected, setSelected] = useState<string[]>(advancedIds);
  const isComplete = advancedIds.length === ROUND1_ADVANCE_COUNT;

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= ROUND1_ADVANCE_COUNT) return prev;
      return [...prev, id];
    });
  };

  return (
    <Card className="border-border">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">
          Group {group.group_number} · {group.members.length} members
          {group.scheduled_at && (
            <span className="ml-2 font-normal text-muted-foreground">
              · {format(new Date(group.scheduled_at), "MMM d · h:mm a")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {group.members.map((member) => {
            const checked = selected.includes(member.id);
            const eliminated = member.outcome === "eliminated";
            return (
              <label
                key={member.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  checked && "border-emerald-500/40 bg-emerald-500/10",
                  eliminated && "opacity-50",
                  isComplete && !checked && "opacity-40"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || (isComplete && !checked)}
                  onChange={() => toggle(member.id)}
                  className="rounded"
                />
                <span className="truncate">{member.display_name}</span>
                {member.outcome === "advanced" && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    Advanced
                  </Badge>
                )}
                {member.outcome === "eliminated" && (
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    Out
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
        {!isComplete && (
          <Button
            type="button"
            size="sm"
            disabled={disabled || selected.length !== ROUND1_ADVANCE_COUNT}
            onClick={() => onConfirm(group.id, selected)}
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm {ROUND1_ADVANCE_COUNT} advancers
          </Button>
        )}
        <GroupScheduleFields group={group} disabled={disabled} />
      </CardContent>
    </Card>
  );
}

function GroupScheduleFields({
  group,
  disabled,
}: {
  group: ChallengeBracketGroup;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`schedule-${group.id}`}>Zoom time</Label>
        <Input
          id={`schedule-${group.id}`}
          type="datetime-local"
          defaultValue={toLocal(group.scheduled_at)}
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

export function ChallengeBracketAdmin({ bracket }: { bracket: ChallengeBracketData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finalZoom, setFinalZoom] = useState(bracket.challenge.final_zoom_url ?? "");

  const prizePool = useMemo(
    () =>
      formatEurosFromCents(
        getChallengePrizePoolCents(bracket.challenge, bracket.participants.length)
      ),
    [bracket.challenge, bracket.participants.length]
  );

  const perEntry = formatEurosFromCents(getPrizePoolCentsPerParticipant(bracket.challenge));

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

  const phase = bracket.currentPhase;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tournament setup</CardTitle>
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
            Round 1: eliminate 5 of 10 per group · Round 2: 1 winner per group · Round 3: crown
            champion · Pay winner manually offline
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round 1 — Semi-elimination (10 → 5)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            disabled={isPending || bracket.participants.length === 0}
            onClick={() => run(() => generateRound1Groups(bracket.challenge.id))}
          >
            <Layers className="mr-2 h-4 w-4" />
            Generate Round 1 groups ({bracket.challenge.group_size} per call)
          </Button>

          {bracket.round1Groups.map((group) => (
            <Round1GroupAdmin
              key={group.id}
              group={group}
              disabled={isPending}
              onConfirm={async (groupId, ids) => {
                await setRound1Advancers(groupId, ids);
                refresh();
              }}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round 2 — Group finals (10 → 1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !isRound1Complete(bracket)}
            onClick={() => run(() => generateRound2Groups(bracket.challenge.id))}
          >
            <Layers className="mr-2 h-4 w-4" />
            Regroup survivors into Round 2
          </Button>

          {bracket.round2Groups.map((group) => (
            <Card key={group.id} className="border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  Group {group.group_number}
                  {group.scheduled_at && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      · {format(new Date(group.scheduled_at), "MMM d · h:mm a")}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <Button
                      key={member.id}
                      type="button"
                      size="sm"
                      variant={member.outcome === "group_winner" ? "default" : "outline"}
                      disabled={isPending || member.outcome === "eliminated"}
                      onClick={() =>
                        run(() => setRound2GroupWinner(group.id, member.id))
                      }
                    >
                      {member.display_name}
                      {member.outcome === "group_winner" && " ✓"}
                    </Button>
                  ))}
                </div>
                <GroupScheduleFields group={group} disabled={isPending} />
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round 3 — Champion final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !isRound2Complete(bracket) || !!bracket.round3Group}
            onClick={() => run(() => createChampionFinal(bracket.challenge.id))}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create champion final from group winners
          </Button>

          {bracket.round3Group && (
            <>
              <div className="flex flex-wrap gap-2">
                {bracket.round3Group.members.map((member) => (
                  <Button
                    key={member.id}
                    type="button"
                    size="sm"
                    variant={member.outcome === "champion" ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => run(() => setChampion(member.id))}
                  >
                    <Crown className="mr-1 h-3 w-3" />
                    {member.display_name}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={finalZoom}
                  onChange={(e) => setFinalZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => updateFinalZoomUrl(bracket.challenge.id, finalZoom))}
                >
                  Save final Zoom
                </Button>
              </div>
              <GroupScheduleFields group={bracket.round3Group} disabled={isPending} />
            </>
          )}
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
        <p className="text-sm font-medium">Bracket preview</p>
        <ChallengeBracketDiagram bracket={bracket} adminMode />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
