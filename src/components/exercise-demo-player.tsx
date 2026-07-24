"use client";

import { ExerciseGifPlayer } from "@/components/exercise-gif-player";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { resolveExerciseGifUrls, type ExerciseGender } from "@/lib/exercise-gif";
import { isValidYoutubeUrl } from "@/lib/youtube";

interface ExerciseDemoPlayerProps {
  name: string;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  videoUrl?: string | null;
  gender?: ExerciseGender | null;
  autoplay?: boolean;
}

export function ExerciseDemoPlayer({
  name,
  imageUrl,
  fallbackImageUrl,
  videoUrl,
  gender,
  autoplay = false,
}: ExerciseDemoPlayerProps) {
  const resolved = resolveExerciseGifUrls({ name, imageUrl, gender });
  const gifUrl = resolved.url;
  const fallbackUrl = fallbackImageUrl ?? resolved.fallbackUrl;

  // Prefer GIF (including same-origin /api/exercise-gif/… proxy URLs).
  if (gifUrl || fallbackUrl) {
    return (
      <ExerciseGifPlayer
        gifUrl={gifUrl}
        fallbackUrl={fallbackUrl}
        title={name}
      />
    );
  }

  if (videoUrl && isValidYoutubeUrl(videoUrl)) {
    return (
      <ExerciseVideoPlayer videoUrl={videoUrl} title={name} autoplay={autoplay} />
    );
  }

  return null;
}
