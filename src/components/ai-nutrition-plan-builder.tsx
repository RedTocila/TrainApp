"use client";

import { Salad } from "lucide-react";
import { AiBuildPromptPanel } from "@/components/ai-build-prompt-panel";
import { AiPlanProfileSummary } from "@/components/ai-plan-profile-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

export function AiNutritionPlanBuilder({
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
            <Salad className="h-4 w-4 text-primary" />
            Build nutrition plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!intakeComplete && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              Add age, gender, weight, and goal for accurate macros.
            </p>
          )}

          <AiBuildPromptPanel
            placeholder="e.g. Vegetarian, no dairy, prefer 4 meals…"
            buildPrompt={(focus) =>
              `Build me a nutrition / meal plan. Preferences: ${focus}`
            }
            hasAiAccess
            accent="emerald"
          />
        </CardContent>
      </Card>
    </div>
  );
}
