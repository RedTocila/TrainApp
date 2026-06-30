"use client";

import { AppDialog } from "@/components/app-dialog";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import type { ExerciseGender } from "@/lib/exercise-gif";

export function ExerciseDemoDialog({
  open,
  onClose,
  name,
  imageUrl,
  videoUrl,
  gender,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  gender?: ExerciseGender | null;
}) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={name}
      description="Exercise demonstration"
      maxWidth="max-w-md"
      zIndex={120}
    >
      <div className="px-5 pb-5">
        <ExerciseDemoPlayer
          name={name}
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          gender={gender}
          autoplay
        />
      </div>
    </AppDialog>
  );
}
