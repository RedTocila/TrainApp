"use client";

import { format } from "date-fns";
import { ExternalLink, Trophy, Video } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Challenge, ChallengeParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChallengeJudgmentZoomPanel({
  challenge,
  participant,
  joinable,
}: {
  challenge: Challenge;
  participant: ChallengeParticipant | null;
  joinable: boolean;
}) {
  const copy = usePlatformCopy().challenges;

  if (!joinable) return null;

  if (!participant) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {copy.zoomRegisterHint}
        </CardContent>
      </Card>
    );
  }

  if (participant.status === "champion") {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardContent className="flex items-center gap-3 p-4">
          <Trophy className="h-5 w-5 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-100">{copy.championLabel}</p>
            <p className="text-sm text-muted-foreground">{copy.championPrizeHint}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (participant.status !== "finalist") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {copy.judgmentZoomPendingHint}
        </CardContent>
      </Card>
    );
  }

  const zoomUrl = challenge.final_zoom_url;
  const scheduledAt = challenge.round_3_zoom_at;

  return (
    <Card className={cn("border-violet-500/40 bg-violet-500/5")}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Video className="h-5 w-5 shrink-0 text-violet-400" />
            <p className="font-semibold">{copy.judgmentZoomTitle}</p>
            <Badge variant="secondary">{copy.judgmentDayInviteLabel}</Badge>
          </div>
          {scheduledAt ? (
            <p className="text-sm font-medium text-primary">
              {format(new Date(scheduledAt), "EEEE, MMM d · h:mm a")}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{copy.judgmentZoomIntro}</p>
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
              {copy.judgmentZoomJoin}
            </a>
          ) : (
            <Button type="button" disabled className="w-full sm:w-auto">
              {copy.judgmentZoomLinkPending}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
