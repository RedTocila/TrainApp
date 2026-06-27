"use client";

import { ExternalLink, Video } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
  const { currentUserParticipantId, groupStage, finalRound, challenge } = bracket;

  const userGroup = groupStage.find((group) =>
    group.members.some((m) => m.id === currentUserParticipantId)
  );

  const userInFinal =
    finalRound?.members.some((m) => m.id === currentUserParticipantId) ?? false;

  const zoomUrl = userInFinal
    ? finalRound?.zoom_url || challenge.final_zoom_url
    : userGroup?.zoom_url;

  const groupLabel = userInFinal
    ? "Final round"
    : userGroup
      ? `Group ${userGroup.group_number}`
      : null;

  if (!joinable) return null;

  if (!currentUserParticipantId) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Register for the challenge to get your group Zoom link when groups are assigned.
        </CardContent>
      </Card>
    );
  }

  if (!groupLabel) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          You are registered. Your group will appear here once the coach generates brackets.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-primary/30", userInFinal && "border-amber-500/40 bg-amber-500/5")}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-semibold">
            <Video className="h-4 w-4 text-primary" />
            {userInFinal ? "Final Zoom call" : `${groupLabel} Zoom call`}
          </p>
          <p className="text-sm text-muted-foreground">
            {userInFinal
              ? "Finalists compared on Zoom — coach picks whoever transformed the most overall."
              : `Up to ${challenge.group_size} people per call. Coach picks whoever transformed the most in your group — not who checked the most boxes.`}
          </p>
        </div>
        {zoomUrl ? (
          <a
            href={zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ className: "shrink-0" })}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Join Zoom
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">Zoom link coming soon</span>
        )}
      </CardContent>
    </Card>
  );
}
