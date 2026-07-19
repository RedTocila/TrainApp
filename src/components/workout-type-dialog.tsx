"use client";

import { AppDialog } from "@/components/app-dialog";
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
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Choose workout type"
      description="Fitness with sets & reps, or timed HIIT intervals."
      ariaLabel="Choose workout type"
      maxWidth="max-w-lg"
    >
      <div className="px-5 py-4">
        <WorkoutTypeChooser value={null} onChange={onSelect} />
      </div>
    </AppDialog>
  );
}
