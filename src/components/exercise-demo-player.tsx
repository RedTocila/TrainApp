"use client";

import { useEffect, useState } from "react";
import { ExerciseGifPlayer } from "@/components/exercise-gif-player";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { resolveExerciseYoutubeUrl } from "@/lib/actions/exercise-videos";
import { resolveExerciseGifUrls, isGifUrl, type ExerciseGender } from "@/lib/exercise-gif";
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
  /** Force video pause (e.g. workout session paused). */
  paused?: boolean;
  /** Fill a parent frame (HIIT media stage) instead of intrinsic aspect ratio. */
  fill?: boolean;
}

function resolveExplicitYoutubeUrl(videoUrl?: string | null): string | null {
  const trimmed = videoUrl?.trim();
  if (!trimmed) return null;
  // Never treat GIF / proxy image URLs as YouTube — that yields a broken player.
  if (isGifUrl(trimmed) || trimmed.includes("/api/exercise-gif/")) return null;
  return isValidYoutubeUrl(trimmed) ? trimmed : null;
}

export function ExerciseDemoPlayer({
  name,
  imageUrl,
  fallbackImageUrl,
  videoUrl,
  gender,
  autoplay = false,
  resolveOverride = true,
  paused = false,
  fill = false,
}: ExerciseDemoPlayerProps) {
  const resolved = resolveExerciseGifUrls({ name, imageUrl, gender });
  const gifUrl = resolved.url;
  const fallbackUrl = fallbackImageUrl ?? resolved.fallbackUrl;

  const explicitVideo = resolveExplicitYoutubeUrl(videoUrl);
  const [overrideVideo, setOverrideVideo] = useState<string | null>(null);
  const [overrideReady, setOverrideReady] = useState(
    () => Boolean(explicitVideo) || !resolveOverride
  );
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [name, explicitVideo, overrideVideo]);

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

  if (effectiveVideo && !videoFailed) {
    return (
      <ExerciseVideoPlayer
        videoUrl={effectiveVideo}
        title={name}
        autoplay={autoplay}
        paused={paused}
        fill={fill}
        onError={() => setVideoFailed(true)}
      />
    );
  }

  // Wait for override lookup so admin YouTube isn't briefly replaced by a GIF.
  if (!overrideReady) {
    return (
      <div
        className={
          fill
            ? "h-full w-full animate-pulse bg-secondary/80"
            : "aspect-video w-full animate-pulse rounded-xl bg-secondary/80"
        }
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
        fill={fill}
      />
    );
  }

  return (
    <div
      className={
        fill
          ? "flex h-full w-full items-center justify-center bg-secondary/60 px-6 text-center"
          : "flex aspect-video w-full items-center justify-center rounded-xl bg-secondary/60 px-6 text-center"
      }
    >
      <p className="text-sm font-medium text-muted-foreground">{name}</p>
    </div>
  );
}
