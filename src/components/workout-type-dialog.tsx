"use client";

import { AppDialog } from "@/components/app-dialog";
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
    <AppDialog
      open={open}
      onClose={onClose}
      title={platform.workout.chooseWorkoutType}
      ariaLabel={platform.workout.chooseWorkoutType}
      maxWidth="max-w-lg"
    >
      <div className="px-5 py-4">
        <WorkoutTypeChooser value={null} onChange={onSelect} />
      </div>
    </AppDialog>
  );
}
