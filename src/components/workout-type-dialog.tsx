"use client";

import { AppOverlay } from "@/components/app-overlay";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  WorkoutTypeChooser,
  type CreateWorkoutType,
} from "@/components/workout-type-chooser";

export function WorkoutTypeDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: CreateWorkoutType) => void;
}) {
  const platform = usePlatformCopy();

  return (
    <AppOverlay open={open} onClose={onClose} presentation="center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={platform.workout.chooseWorkoutType}
        className="relative z-10 w-full max-w-sm px-4"
      >
        <WorkoutTypeChooser value={null} onChange={onSelect} />
      </div>
    </AppOverlay>
  );
}
