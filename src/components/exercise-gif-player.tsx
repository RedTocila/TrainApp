"use client";

import { ExerciseGifImage } from "@/components/exercise-gif-image";

interface ExerciseGifPlayerProps {
  gifUrl?: string | null;
  fallbackUrl?: string | null;
  title: string;
  /** Fill a parent frame instead of a fixed square aspect. */
  fill?: boolean;
}

export function ExerciseGifPlayer({
  gifUrl,
  fallbackUrl,
  title,
  fill = false,
}: ExerciseGifPlayerProps) {
  if (!gifUrl && !fallbackUrl) return null;

  if (fill) {
    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
        <ExerciseGifImage
          gifUrl={gifUrl}
          fallbackUrl={fallbackUrl}
          alt={`${title} demonstration`}
          className="absolute inset-0 size-full bg-black"
          imgClassName="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted">
      <ExerciseGifImage
        gifUrl={gifUrl}
        fallbackUrl={fallbackUrl}
        alt={`${title} demonstration`}
        className="relative mx-auto aspect-square w-full max-w-2xl"
        imgClassName="absolute inset-0"
      />
    </div>
  );
}
