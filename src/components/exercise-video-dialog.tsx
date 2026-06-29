"use client";

import { AppDialog } from "@/components/app-dialog";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";

export function ExerciseVideoDialog({
  open,
  onClose,
  videoUrl,
  title,
}: {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      description="Exercise demo"
      maxWidth="max-w-2xl"
      zIndex={120}
    >
      <div className="px-5 pb-5">
        <ExerciseVideoPlayer videoUrl={videoUrl} title={title} autoplay />
      </div>
    </AppDialog>
  );
}
