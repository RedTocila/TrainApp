"use client";

import { useState, type ReactNode } from "react";
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
} from "@/lib/types";
import { cn } from "@/lib/utils";

function ParticipantChip({
  participant,
  highlight,
  isYou,
  onClick,
  selectable,
}: {
  participant: ChallengeBracketParticipant;
  highlight?: "winner" | "champion" | "you";
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
          "border-amber-400/60 bg-amber-500/15 font-semibold text-amber-100 shadow-md shadow-amber-500/10",
        highlight === "winner" &&
          "border-violet-400/50 bg-violet-500/15 font-medium text-violet-100",
        isYou && !highlight && "border-primary/40 bg-primary/10",
        !highlight && !isYou && "border-border bg-card/80",
        selectable && "cursor-pointer hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          highlight === "champion" ? "bg-amber-500/25" : "bg-muted"
        )}
      >
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
}: {
  group: ChallengeBracketGroup;
  youId?: string | null;
  adminMode?: boolean;
  onSelectWinner?: (groupId: string, participantId: string) => void;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isYourGroup = group.members.some((m) => m.id === youId);

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isYourGroup && "ring-1 ring-primary/40",
        open && "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 border-b border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/30 sm:px-5"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">Group {group.group_number}</span>
            <Badge variant="secondary" className="text-[10px]">
              {group.members.length} members
            </Badge>
            {isYourGroup && (
              <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                Your group
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {group.winner ? (
              <span className="inline-flex items-center gap-1 text-violet-300">
                <Medal className="h-3 w-3" />
                {group.winner.display_name}
              </span>
            ) : (
              "Winner not selected yet"
            )}
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
                highlight={group.winner_participant_id === member.id ? "winner" : undefined}
                isYou={member.id === youId}
                selectable={adminMode && !!onSelectWinner}
                onClick={
                  adminMode && onSelectWinner
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
  const { groupStage, finalRound, champion, participants, challenge } = bracket;
  const youId = currentUserParticipantId ?? bracket.currentUserParticipantId;

  if (participants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No participants yet. Members register from this page; the coach then builds groups of{" "}
          {challenge.group_size}.
        </CardContent>
      </Card>
    );
  }

  if (groupStage.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {participants.length} registered
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <ParticipantChip
                key={p.id}
                participant={{
                  ...p,
                  is_champion: false,
                  is_group_winner: false,
                  group_id: null,
                  group_number: null,
                  round: null,
                }}
                isYou={p.id === youId}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for the coach to split everyone into groups of {challenge.group_size} and assign
            Zoom links.
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

      {finalRound && (
        <section className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <span>Final round</span>
            <Badge variant="outline">{finalRound.members.length} finalists</Badge>
          </div>
          <Card className="border-amber-500/30">
            <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {finalRound.members.map((member) => (
                <ParticipantChip
                  key={member.id}
                  participant={member}
                  highlight={
                    champion?.id === member.id
                      ? "champion"
                      : finalRound.winner_participant_id === member.id
                        ? "winner"
                        : undefined
                  }
                  isYou={member.id === youId}
                  selectable={adminMode && !!onSelectWinner}
                  onClick={
                    adminMode && onSelectWinner
                      ? () => onSelectWinner(finalRound.id, member.id)
                      : undefined
                  }
                />
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-center text-muted-foreground">
            <ArrowDown className="h-5 w-5" />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4" />
            Group stage · {groupStage.length} groups × ~{challenge.group_size}
          </h3>
          <Badge variant="secondary">{participants.length} total</Badge>
        </div>

        <div className="space-y-2">
          {groupStage.map((group) => (
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
    </div>
  );
}
