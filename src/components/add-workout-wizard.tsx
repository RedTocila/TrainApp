"use client";

import { useEffect, useState } from "react";
import { getPersonalWorkoutPlanWithDetails } from "@/lib/actions/user-workouts";
import { usePlatformCopy } from "@/components/locale-provider";
import { WorkoutBuilder } from "@/components/workout-builder";
import { HiitBuilder } from "@/components/hiit-builder";
import { WorkoutTypeDialog } from "@/components/workout-type-dialog";
import type { CreateWorkoutType } from "@/components/workout-type-chooser";
import { WorkoutScheduleForm } from "@/components/workout-schedule-form";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";

interface AddWorkoutWizardProps {
  open: boolean;
  folderId: string;
  onClose: () => void;
  onComplete: () => void;
}

type WizardPhase = "type" | "build" | "schedule";

export function AddWorkoutWizard({ open, folderId, onClose, onComplete }: AddWorkoutWizardProps) {
  const platform = usePlatformCopy();
  const [phase, setPhase] = useState<WizardPhase>("type");
  const [workoutType, setWorkoutType] = useState<CreateWorkoutType | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [days, setDays] = useState<Awaited<ReturnType<typeof getPersonalWorkoutPlanWithDetails>>["days"]>([]);

  useEffect(() => {
    if (!open) {
      setPhase("type");
      setWorkoutType(null);
      setPlanId(null);
      setDays([]);
    }
  }, [open]);

  const handleTypeSelect = (type: CreateWorkoutType) => {
    setWorkoutType(type);
    setPhase("build");
  };

  const handleBuilt = async (newPlanId: string) => {
    const { days: savedDays } = await getPersonalWorkoutPlanWithDetails(newPlanId);
    setPlanId(newPlanId);
    setDays(savedDays);
    setPhase("schedule");
  };

  const handleCloseAll = () => {
    onClose();
  };

  return (
    <>
      <WorkoutTypeDialog
        open={open && phase === "type"}
        onClose={handleCloseAll}
        onSelect={handleTypeSelect}
      />

      <FullScreenFlow
        open={open && (phase === "build" || phase === "schedule")}
        onClose={handleCloseAll}
        onBack={() => {
          if (phase === "schedule") {
            setPhase("build");
            return;
          }
          setPhase("type");
        }}
        subtitle={phase === "build" ? "Step 1 of 2" : "Step 2 of 2"}
        title={
          phase === "schedule"
            ? platform.workout.scheduleWorkout
            : workoutType === "hiit"
              ? platform.workout.buildHiitWorkout
              : platform.workout.buildWorkout
        }
      >
        {phase === "build" ? (
          workoutType === "hiit" ? (
            <HiitBuilder
              wizard
              folderId={folderId}
              onWizardComplete={handleBuilt}
            />
          ) : (
            <WorkoutBuilder
              mode="client"
              wizard
              folderId={folderId}
              onWizardComplete={handleBuilt}
            />
          )
        ) : planId ? (
          <WorkoutScheduleForm
            planId={planId}
            days={days}
            initialSchedule={null}
            showBackButton
            onBack={() => setPhase("build")}
            onSaved={() => {
              onComplete();
              onClose();
            }}
          />
        ) : null}
      </FullScreenFlow>
    </>
  );
}
