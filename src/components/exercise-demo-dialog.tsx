"use client";

import { AppDialog } from "@/components/app-dialog";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import type { ExerciseGender } from "@/lib/exercise-gif";

export function ExerciseDemoDialog({
  open,
  onClose,
  name,
  imageUrl,
  fallbackImageUrl,
  videoUrl,
  gender,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  videoUrl?: string | null;
  gender?: ExerciseGender | null;
}) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={name}
      description="Exercise demonstration"
      maxWidth="max-w-2xl"
      zIndex={120}
    >
      <div className="px-4 pb-5 sm:px-6">
        {open ? (
          <ExerciseDemoPlayer
            name={name}
            imageUrl={imageUrl}
            fallbackImageUrl={fallbackImageUrl}
            videoUrl={videoUrl}
            gender={gender}
            autoplay
            resolveOverride
          />
        ) : null}
      </div>
    </AppDialog>
  );
}
