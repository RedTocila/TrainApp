"use client";

import { useEffect, useState } from "react";
import { getPersonalWorkoutPlanWithDetails } from "@/lib/actions/user-workouts";
import { WorkoutBuilder } from "@/components/workout-builder";
import { WorkoutScheduleForm } from "@/components/workout-schedule-form";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";

interface AddWorkoutWizardProps {
  open: boolean;
  folderId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function AddWorkoutWizard({ open, folderId, onClose, onComplete }: AddWorkoutWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [planId, setPlanId] = useState<string | null>(null);
  const [days, setDays] = useState<Awaited<ReturnType<typeof getPersonalWorkoutPlanWithDetails>>["days"]>([]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setPlanId(null);
      setDays([]);
    }
  }, [open]);

  const handleBuilt = async (newPlanId: string) => {
    const { days: savedDays } = await getPersonalWorkoutPlanWithDetails(newPlanId);
    setPlanId(newPlanId);
    setDays(savedDays);
    setStep(2);
  };

  return (
    <FullScreenFlow
      open={open}
      onClose={onClose}
      subtitle={`Step ${step} of 2`}
      title={step === 1 ? "Build workout" : "Schedule workout"}
    >
      {step === 1 ? (
        <WorkoutBuilder
          mode="client"
          wizard
          folderId={folderId}
          onWizardComplete={handleBuilt}
        />
      ) : planId ? (
        <WorkoutScheduleForm
          planId={planId}
          days={days}
          initialSchedule={null}
          showBackButton
          onBack={() => setStep(1)}
          onSaved={() => {
            onComplete();
            onClose();
          }}
        />
      ) : null}
    </FullScreenFlow>
  );
}
