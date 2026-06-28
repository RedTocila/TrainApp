"use client";

import { format } from "date-fns";
import { ExternalLink, Trophy, UserX, Video } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ChallengeBracketData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChallengeZoomPanel({
  bracket,
  joinable,
}: {
  bracket: ChallengeBracketData;
  joinable: boolean;
}) {
  const copy = usePlatformCopy().challenges;
  const { currentUserParticipantId, round1Groups, round2Groups, round3Group, challenge } =
    bracket;

  const participant = bracket.participants.find((p) => p.id === currentUserParticipantId);

  const allGroups = [...round1Groups, ...round2Groups, ...(round3Group ? [round3Group] : [])];
  const userGroup = allGroups.find((g) =>
    g.members.some((m) => m.id === currentUserParticipantId)
  );

  if (!joinable) return null;

  if (!currentUserParticipantId) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {copy.zoomRegisterHint}
        </CardContent>
      </Card>
    );
  }

  if (participant?.status === "champion") {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardContent className="flex items-center gap-3 p-4">
          <Trophy className="h-5 w-5 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-100">You are the champion</p>
            <p className="text-sm text-muted-foreground">
              Prize paid manually by the organizer — no in-app cashout.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (participant?.status === "eliminated") {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="flex items-center gap-3 p-4">
          <UserX className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Eliminated in Round {participant.eliminated_round ?? "?"}. Thanks for competing — keep
            logging and join the next challenge.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!userGroup) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {copy.zoomPendingHint}
        </CardContent>
      </Card>
    );
  }

  const zoomUrl =
    userGroup.zoom_url ?? (userGroup.round === 3 ? challenge.final_zoom_url : null);
  const groupSize = String(challenge.group_size);
  const isFinal = userGroup.round === 3;

  const roundLabel =
    userGroup.round === 1
      ? "Round 1 · Semi-elimination"
      : userGroup.round === 2
        ? "Round 2 · Group final"
        : "Champion final";

  const roundIntro = isFinal
    ? copy.zoomFinalIntro
    : userGroup.round === 1
      ? copy.zoomRound1Intro.replace("{groupSize}", groupSize)
      : copy.zoomRound2Intro.replace("{groupSize}", groupSize);

  return (
    <Card className={cn("border-primary/30", isFinal && "border-amber-500/40 bg-amber-500/5")}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Video className="h-5 w-5 shrink-0 text-primary" />
            <p className="font-semibold">
              You&apos;re in · {roundLabel} · Group {userGroup.group_number}
            </p>
            {participant?.status === "finalist" && (
              <Badge variant="secondary">Finalist</Badge>
            )}
          </div>
          {userGroup.scheduled_at && (
            <p className="text-sm font-medium text-primary">
              {format(new Date(userGroup.scheduled_at), "EEEE, MMM d · h:mm a")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{roundIntro}</p>
        </div>
        <div className="shrink-0">
          {zoomUrl ? (
            <a
              href={zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Join Zoom
            </a>
          ) : (
            <Button type="button" disabled className="w-full sm:w-auto">
              Zoom link coming soon
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
