"use client";

import { ExerciseGifImage } from "@/components/exercise-gif-image";

interface ExerciseGifPlayerProps {
  gifUrl?: string | null;
  fallbackUrl?: string | null;
  title: string;
}

export function ExerciseGifPlayer({
  gifUrl,
  fallbackUrl,
  title,
}: ExerciseGifPlayerProps) {
  if (!gifUrl && !fallbackUrl) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <ExerciseGifImage
        gifUrl={gifUrl}
        fallbackUrl={fallbackUrl}
        alt={`${title} demonstration`}
        className="relative mx-auto aspect-square w-full max-w-md"
        imgClassName="absolute inset-0"
      />
    </div>
  );
}
