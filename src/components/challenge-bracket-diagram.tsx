"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  ArrowDown,
  ChevronDown,
  Crown,
  Medal,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
  ChallengeMemberOutcome,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function outcomeHighlight(
  outcome: ChallengeMemberOutcome,
  isWinner: boolean
): "winner" | "champion" | "advanced" | "eliminated" | undefined {
  if (outcome === "champion") return "champion";
  if (outcome === "group_winner" || isWinner) return "winner";
  if (outcome === "advanced") return "advanced";
  if (outcome === "eliminated") return "eliminated";
  return undefined;
}

function ParticipantChip({
  participant,
  highlight,
  isYou,
  onClick,
  selectable,
}: {
  participant: ChallengeBracketParticipant;
  highlight?: "winner" | "champion" | "advanced" | "eliminated";
  isYou?: boolean;
  onClick?: () => void;
  selectable?: boolean;
}) {
  const Tag = selectable ? "button" : "div";

  return (
    <Tag
      type={selectable ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
        highlight === "champion" &&
          "border-amber-400/60 bg-amber-500/15 font-semibold text-amber-100",
        highlight === "winner" &&
          "border-violet-400/50 bg-violet-500/15 font-medium text-violet-100",
        highlight === "advanced" &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
        highlight === "eliminated" && "border-border/50 bg-muted/30 opacity-50",
        isYou && !highlight && "border-primary/40 bg-primary/10",
        !highlight && !isYou && "border-border bg-card/80",
        selectable && "cursor-pointer hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        {highlight === "champion" ? (
          <Crown className="h-3.5 w-3.5 text-amber-300" />
        ) : highlight === "winner" ? (
          <Medal className="h-3.5 w-3.5 text-violet-300" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 truncate">{participant.display_name}</span>
      {isYou && (
        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
          You
        </Badge>
      )}
    </Tag>
  );
}

export function ChallengeGroupAccordion({
  group,
  youId,
  adminMode = false,
  onSelectWinner,
  footer,
  roundLabel,
}: {
  group: ChallengeBracketGroup;
  youId?: string | null;
  adminMode?: boolean;
  onSelectWinner?: (groupId: string, participantId: string) => void;
  footer?: ReactNode;
  roundLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const isYourGroup = group.members.some((m) => m.id === youId);
  const advancedCount = group.members.filter((m) => m.outcome === "advanced").length;

  return (
    <Card className={cn("overflow-hidden", isYourGroup && "ring-1 ring-primary/40")}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 sm:px-5"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">
              {roundLabel ? `${roundLabel} · ` : ""}Group {group.group_number}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {group.members.length} members
            </Badge>
            {group.scheduled_at && (
              <Badge variant="outline" className="text-[10px]">
                {format(new Date(group.scheduled_at), "MMM d · h:mm a")}
              </Badge>
            )}
            {isYourGroup && (
              <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                Your group
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {group.round === 1 && advancedCount > 0
              ? `${advancedCount} advanced`
              : group.winner
                ? group.winner.display_name
                : "Pending"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <CardContent className="space-y-3 border-t border-border/60 bg-muted/10 p-3 sm:p-4">
          <div className="grid gap-2">
            {group.members.map((member) => (
              <ParticipantChip
                key={member.id}
                participant={member}
                highlight={outcomeHighlight(
                  member.outcome,
                  group.winner_participant_id === member.id
                )}
                isYou={member.id === youId}
                selectable={adminMode && !!onSelectWinner && group.round !== 1}
                onClick={
                  adminMode && onSelectWinner && group.round !== 1
                    ? () => onSelectWinner(group.id, member.id)
                    : undefined
                }
              />
            ))}
          </div>
          {footer}
        </CardContent>
      ) : null}
    </Card>
  );
}

function RoundSection({
  title,
  groups,
  youId,
  adminMode,
  onSelectWinner,
}: {
  title: string;
  groups: ChallengeBracketGroup[];
  youId?: string | null;
  adminMode?: boolean;
  onSelectWinner?: (groupId: string, participantId: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Users className="h-4 w-4" />
        {title}
      </h3>
      <div className="space-y-2">
        {groups.map((group) => (
          <ChallengeGroupAccordion
            key={group.id}
            group={group}
            youId={youId}
            adminMode={adminMode}
            onSelectWinner={onSelectWinner}
          />
        ))}
      </div>
    </section>
  );
}

export function ChallengeBracketDiagram({
  bracket,
  currentUserParticipantId,
  onSelectWinner,
  adminMode = false,
}: {
  bracket: ChallengeBracketData;
  currentUserParticipantId?: string | null;
  onSelectWinner?: (groupId: string, participantId: string) => void;
  adminMode?: boolean;
}) {
  const { round1Groups, round2Groups, round3Group, champion, participants, challenge } = bracket;
  const youId = currentUserParticipantId ?? bracket.currentUserParticipantId;

  if (participants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No participants yet. Elite members register from the challenge page.
        </CardContent>
      </Card>
    );
  }

  if (round1Groups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {participants.length} registered
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Waiting for groups of {challenge.group_size} to be drawn before the first elimination
            day.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {champion && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/25">
            <Trophy className="h-7 w-7 text-amber-300" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300/90">Champion</p>
          <p className="mt-1 text-2xl font-black">{champion.display_name}</p>
        </section>
      )}

      {round3Group && (
        <section className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Champion final
            <Badge variant="outline">{round3Group.members.length} finalists</Badge>
          </div>
          <Card className="border-amber-500/30">
            <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {round3Group.members.map((member) => (
                <ParticipantChip
                  key={member.id}
                  participant={member}
                  highlight={outcomeHighlight(
                    member.outcome,
                    round3Group.winner_participant_id === member.id
                  )}
                  isYou={member.id === youId}
                />
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-center text-muted-foreground">
            <ArrowDown className="h-5 w-5" />
          </div>
        </section>
      )}

      <RoundSection
        title={`Round 2 · ${round2Groups.length} groups`}
        groups={round2Groups}
        youId={youId}
        adminMode={adminMode}
        onSelectWinner={onSelectWinner}
      />

      {round2Groups.length > 0 && round1Groups.length > 0 && (
        <div className="flex justify-center text-muted-foreground">
          <ArrowDown className="h-5 w-5" />
        </div>
      )}

      <RoundSection
        title={`Round 1 · ${round1Groups.length} groups × ~${challenge.group_size}`}
        groups={round1Groups}
        youId={youId}
        adminMode={adminMode}
        onSelectWinner={onSelectWinner}
      />
    </div>
  );
}
