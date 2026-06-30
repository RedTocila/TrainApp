"use client";

import { ExerciseGifPlayer } from "@/components/exercise-gif-player";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { isGifUrl, resolveExerciseGifUrls, type ExerciseGender } from "@/lib/exercise-gif";
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
  const gifUrl = imageUrl?.trim() || resolved.url;
  const fallbackUrl = fallbackImageUrl ?? resolved.fallbackUrl;

  if (gifUrl && isGifUrl(gifUrl)) {
    return (
      <ExerciseGifPlayer gifUrl={gifUrl} fallbackUrl={fallbackUrl} title={name} />
    );
  }

  if (videoUrl && isValidYoutubeUrl(videoUrl)) {
    return <ExerciseVideoPlayer videoUrl={videoUrl} title={name} autoplay={autoplay} />;
  }

  return null;
}
