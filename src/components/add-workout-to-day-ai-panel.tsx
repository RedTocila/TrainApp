"use client";

import { AiBuildPromptPanel } from "@/components/ai-build-prompt-panel";
import { usePlatformCopy } from "@/components/locale-provider";

export function AddWorkoutToDayAiPanel({
  dateKey,
  onAdded,
}: {
  dateKey: string;
  onAdded: () => void;
}) {
  const platform = usePlatformCopy();

  return (
    <AiBuildPromptPanel
      placeholder={platform.workout.aiFullDayPlaceholder}
      buildPrompt={(focus) =>
        `Build a full training day for ${dateKey} with warm-up, main workout, and stretch. Focus: ${focus}`
      }
      onSubmitted={onAdded}
      accent="violet"
    />
  );
}
