"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPersonalWorkoutPlanWithDetails } from "@/lib/actions/user-workouts";
import { WorkoutBuilder } from "@/components/workout-builder";
import { WorkoutScheduleForm } from "@/components/workout-schedule-form";
import { Button } from "@/components/ui/button";

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

  if (!open) return null;

  return (
    <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Step {step} of 2
            </p>
            <h2 className="text-lg font-black">
              {step === 1 ? "Build workout" : "Schedule workout"}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
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
        </div>
      </div>
    </div>
  );
}
