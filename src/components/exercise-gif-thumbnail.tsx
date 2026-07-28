"use client";

import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { ExerciseDemoDialog } from "@/components/exercise-demo-dialog";
import { findCatalogExercise } from "@/lib/exercise-catalog";
import {
  resolveExerciseGifUrls,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import { extractYoutubeId } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-10 w-10 rounded-lg border border-border",
  md: "h-12 w-12 rounded-lg border border-border",
  lg: "h-16 w-16 rounded-lg border border-border",
} as const;

/** True when this exercise name can open a demo (GIF, stored YouTube, or admin override). */
export function exerciseCanShowDemo(
  name: string,
  videoUrl?: string | null,
  imageUrl?: string | null
): boolean {
  if (!name.trim()) return false;
  if (videoUrl?.trim()) return true;
  if (imageUrl?.trim()) return true;
  if (findCatalogExercise(name)) return true;
  return false;
}

function youtubeThumbnailUrl(videoUrl?: string | null): string | null {
  const id = videoUrl?.trim() ? extractYoutubeId(videoUrl) : null;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function ExerciseGifThumbnail({
  name,
  imageUrl,
  videoUrl,
  gender,
  size = "md",
  className,
  expandable = false,
}: {
  name: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  gender?: ExerciseGender | string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  expandable?: boolean;
}) {
  const resolvedGender = resolveProfileGender(gender);
  const { url, fallbackUrl } = useMemo(
    () => resolveExerciseGifUrls({ name, imageUrl, gender: resolvedGender }),
    [name, imageUrl, resolvedGender]
  );
  const youtubeThumb = useMemo(() => youtubeThumbnailUrl(videoUrl), [videoUrl]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [youtubeFailed, setYoutubeFailed] = useState(false);
  const hasDemo = exerciseCanShowDemo(name, videoUrl, imageUrl) || !!url;
  const sizeClass = SIZE_CLASS[size];
  const showYoutube = Boolean(youtubeThumb) && !youtubeFailed;

  useEffect(() => {
    setYoutubeFailed(false);
  }, [youtubeThumb]);

  const media = showYoutube ? (
    <div className={cn("overflow-hidden bg-secondary/40", sizeClass, !expandable && className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={youtubeThumb!}
        alt={`${name} demonstration`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setYoutubeFailed(true)}
      />
    </div>
  ) : (
    <ExerciseGifImage
      gifUrl={url}
      fallbackUrl={fallbackUrl}
      alt={`${name} demonstration`}
      className={cn(sizeClass, !expandable && className)}
    />
  );

  if (!expandable || !hasDemo) {
    return media;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "group relative shrink-0 overflow-hidden bg-secondary/40 ring-offset-background transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sizeClass,
          className
        )}
        aria-label={`Preview ${name}`}
      >
        {showYoutube ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={youtubeThumb!}
            alt={`${name} demonstration`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setYoutubeFailed(true)}
          />
        ) : url || fallbackUrl ? (
          <ExerciseGifImage
            gifUrl={url}
            fallbackUrl={fallbackUrl}
            alt={`${name} demonstration`}
            className={sizeClass}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-secondary/60" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/35">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 shadow-sm transition group-hover:bg-black/60 group-hover:scale-105">
            <Play
              className={cn(
                "fill-white text-white opacity-70 drop-shadow transition group-hover:opacity-100",
                size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
            />
          </span>
        </span>
      </button>
      <ExerciseDemoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        name={name}
        imageUrl={url}
        fallbackImageUrl={fallbackUrl}
        videoUrl={videoUrl}
        gender={resolvedGender}
      />
    </>
  );
}
