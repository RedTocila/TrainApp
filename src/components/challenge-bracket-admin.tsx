"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Layers, Sparkles, Video } from "lucide-react";
import {
  createFinalRound,
  generateChallengeGroups,
  setGroupWinner,
  updateFinalZoomUrl,
  updateGroupZoomUrl,
} from "@/lib/actions/challenge-bracket";
import {
  ChallengeBracketDiagram,
  ChallengeGroupAccordion,
} from "@/components/challenge-bracket-diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChallengeBracketData } from "@/lib/types";

export function ChallengeBracketAdmin({ bracket }: { bracket: ChallengeBracketData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finalZoom, setFinalZoom] = useState(bracket.challenge.final_zoom_url ?? "");

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

  const allGroupWinnersPicked =
    bracket.groupStage.length > 0 &&
    bracket.groupStage.every((g) => g.winner_participant_id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bracket setup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={isPending || bracket.participants.length === 0}
            onClick={() => run(() => generateChallengeGroups(bracket.challenge.id))}
          >
            <Layers className="mr-2 h-4 w-4" />
            Generate groups ({bracket.challenge.group_size} per call)
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !allGroupWinnersPicked || !!bracket.finalRound}
            onClick={() => run(() => createFinalRound(bracket.challenge.id))}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create final round from group winners
          </Button>
        </CardContent>
      </Card>

      {bracket.groupStage.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Group Zoom links</CardTitle>
            <p className="text-xs text-muted-foreground">
              Expand a group to set its Zoom link.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {bracket.groupStage.map((group) => (
              <ChallengeGroupAccordion
                key={`zoom-${group.id}`}
                group={group}
                footer={
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <Label htmlFor={`zoom-${group.id}`}>Zoom link</Label>
                    <Input
                      id={`zoom-${group.id}`}
                      defaultValue={group.zoom_url ?? ""}
                      placeholder="https://zoom.us/j/..."
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value === (group.zoom_url ?? "")) return;
                        run(() => updateGroupZoomUrl(group.id, value));
                      }}
                    />
                  </div>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {bracket.finalRound && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4" />
              Final round Zoom link
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={finalZoom}
              onChange={(e) => setFinalZoom(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await updateFinalZoomUrl(bracket.challenge.id, finalZoom);
                  if (bracket.finalRound) {
                    await updateGroupZoomUrl(bracket.finalRound.id, finalZoom);
                  }
                })
              }
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Expand a group, then click a participant to mark who transformed the most (or pick the
          champion in the final round above).
        </p>
        <ChallengeBracketDiagram
          bracket={bracket}
          adminMode
          onSelectWinner={(groupId, participantId) =>
            run(() => setGroupWinner(groupId, participantId))
          }
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
