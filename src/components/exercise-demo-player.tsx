"use client";

import { useEffect, useState } from "react";
import { ExerciseGifPlayer } from "@/components/exercise-gif-player";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { resolveExerciseYoutubeUrl } from "@/lib/actions/exercise-videos";
import { resolveExerciseGifUrls, type ExerciseGender } from "@/lib/exercise-gif";
import { isValidYoutubeUrl } from "@/lib/youtube";

interface ExerciseDemoPlayerProps {
  name: string;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  videoUrl?: string | null;
  gender?: ExerciseGender | null;
  autoplay?: boolean;
  /** When false, skip fetching admin YouTube overrides (e.g. closed dialog). */
  resolveOverride?: boolean;
}

export function ExerciseDemoPlayer({
  name,
  imageUrl,
  fallbackImageUrl,
  videoUrl,
  gender,
  autoplay = false,
  resolveOverride = true,
}: ExerciseDemoPlayerProps) {
  const resolved = resolveExerciseGifUrls({ name, imageUrl, gender });
  const gifUrl = resolved.url;
  const fallbackUrl = fallbackImageUrl ?? resolved.fallbackUrl;

  const explicitVideo =
    videoUrl && isValidYoutubeUrl(videoUrl) ? videoUrl.trim() : null;
  const [overrideVideo, setOverrideVideo] = useState<string | null>(null);
  const [overrideReady, setOverrideReady] = useState(
    () => Boolean(explicitVideo) || !resolveOverride
  );

  useEffect(() => {
    if (explicitVideo || !resolveOverride || !name.trim()) {
      setOverrideVideo(null);
      setOverrideReady(true);
      return;
    }

    let cancelled = false;
    setOverrideReady(false);
    void resolveExerciseYoutubeUrl(name).then((url) => {
      if (cancelled) return;
      setOverrideVideo(url && isValidYoutubeUrl(url) ? url.trim() : null);
      setOverrideReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [name, explicitVideo, resolveOverride]);

  const effectiveVideo = explicitVideo ?? overrideVideo;

  if (effectiveVideo) {
    return (
      <ExerciseVideoPlayer
        videoUrl={effectiveVideo}
        title={name}
        autoplay={autoplay}
      />
    );
  }

  // Wait for override lookup so admin YouTube isn't briefly replaced by a GIF.
  if (!overrideReady) {
    return (
      <div
        className="aspect-video w-full animate-pulse rounded-xl bg-secondary/80"
        role="status"
        aria-busy="true"
        aria-label={`Loading ${name} demonstration`}
      />
    );
  }

  // Fall back to GIF (including same-origin /api/exercise-gif/… proxy URLs).
  if (gifUrl || fallbackUrl) {
    return (
      <ExerciseGifPlayer
        gifUrl={gifUrl}
        fallbackUrl={fallbackUrl}
        title={name}
      />
    );
  }

  return null;
}
