"use client";

import { getYoutubeEmbedUrl } from "@/lib/youtube";

interface ExerciseVideoPlayerProps {
  videoUrl?: string | null;
  title: string;
}

export function ExerciseVideoPlayer({ videoUrl, title }: ExerciseVideoPlayerProps) {
  const embedUrl = videoUrl ? getYoutubeEmbedUrl(videoUrl) : null;

  if (!embedUrl) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <div className="relative aspect-video w-full">
        <iframe
          src={embedUrl}
          title={`${title} demo video`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
