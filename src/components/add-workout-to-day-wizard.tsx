"use client";

import { useEffect, useState, useTransition } from "react";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";
import { usePlatformCopy } from "@/components/locale-provider";
import { WorkoutBuilder } from "@/components/workout-builder";
import { HiitBuilder } from "@/components/hiit-builder";
import { WorkoutTypeDialog } from "@/components/workout-type-dialog";
import type { CreateWorkoutType } from "@/components/workout-type-chooser";
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
  initialType = null,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  onComplete: () => void;
  /** When set, skip the type chooser and open the matching builder. */
  initialType?: CreateWorkoutType | null;
}) {
  const platform = usePlatformCopy();
  const [phase, setPhase] = useState<"type" | "build">(
    initialType ? "build" : "type"
  );
  const [workoutType, setWorkoutType] = useState<CreateWorkoutType | null>(
    initialType
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setPhase("type");
      setWorkoutType(null);
      setError(null);
      return;
    }
    if (initialType) {
      setWorkoutType(initialType);
      setPhase("build");
    } else {
      setWorkoutType(null);
      setPhase("type");
    }
  }, [open, initialType]);

  const handleTypeSelect = (type: CreateWorkoutType) => {
    setWorkoutType(type);
    setPhase("build");
  };

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

  const showTypeDialog = open && phase === "type" && !initialType;

  return (
    <>
      <WorkoutTypeDialog
        open={showTypeDialog}
        onClose={onClose}
        onSelect={handleTypeSelect}
      />

      <FullScreenFlow
        open={open && phase === "build" && !!workoutType}
        onClose={onClose}
        onBack={
          initialType
            ? onClose
            : () => {
                setPhase("type");
                setWorkoutType(null);
              }
        }
        title={
          workoutType === "hiit"
            ? platform.workout.buildHiitWorkout
            : platform.workout.buildWorkout
        }
        subtitle={platform.workout.forThisDayOnly}
      >
        <div className="space-y-4">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {workoutType === "hiit" ? (
            <HiitBuilder
              wizard
              folderId={UNCATEGORIZED_FOLDER_ID}
              onWizardComplete={handleBuilt}
            />
          ) : workoutType === "strength" ? (
            <WorkoutBuilder
              mode="client"
              wizard
              singleDay
              folderId={UNCATEGORIZED_FOLDER_ID}
              onWizardComplete={handleBuilt}
            />
          ) : null}
          {isPending ? (
            <p className="text-sm text-muted-foreground" role="status">
              {platform.common.saving}
            </p>
          ) : null}
        </div>
      </FullScreenFlow>
    </>
  );
}
