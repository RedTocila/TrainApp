"use client";

import { Dumbbell } from "lucide-react";
import { AiBuildPromptPanel } from "@/components/ai-build-prompt-panel";
import { AiPlanProfileSummary } from "@/components/ai-plan-profile-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

export function AiWorkoutPlanBuilder({
  profile,
  intakeComplete,
}: {
  profile: Profile;
  intakeComplete: boolean;
}) {
  return (
    <div className="space-y-6">
      <AiPlanProfileSummary profile={profile} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-4 w-4 text-primary" />
            Build workout plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!intakeComplete && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              For best results, complete your health profile first.
            </p>
          )}

          <AiBuildPromptPanel
            placeholder="e.g. Full body fitness, home gym, 45 min, 4 days…"
            buildPrompt={(focus) => `Build me a workout plan. Focus: ${focus}`}
            hasAiAccess
            accent="violet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
