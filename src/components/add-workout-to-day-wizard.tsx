"use client";

import { useState, useTransition } from "react";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";
import { WorkoutBuilder } from "@/components/workout-builder";
import {
  addWorkoutToDay,
  getPersonalWorkoutPlanWithDetails,
} from "@/lib/actions/user-workouts";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";

export function AddWorkoutToDayWizard({
  open,
  onClose,
  dateKey,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  onComplete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBuilt = (planId: string) => {
    setError(null);
    startTransition(async () => {
      const { days } = await getPersonalWorkoutPlanWithDetails(planId);
      const dayId = days[0]?.id;
      if (!dayId) {
        setError("Could not save workout day");
        return;
      }
      const result = await addWorkoutToDay(dateKey, planId, dayId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onComplete();
      onClose();
    });
  };

  return (
    <FullScreenFlow
      open={open}
      onClose={onClose}
      title="Build workout"
      subtitle="For this day only"
    >
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-8 pt-2">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <WorkoutBuilder
          mode="client"
          wizard
          singleDay
          folderId={UNCATEGORIZED_FOLDER_ID}
          onWizardComplete={handleBuilt}
        />
        {isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            Adding to your day…
          </p>
        ) : null}
      </div>
    </FullScreenFlow>
  );
}
