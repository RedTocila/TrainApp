"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Dumbbell, Play } from "lucide-react";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { ExerciseDemoDialog } from "@/components/exercise-demo-dialog";
import { resolveExerciseYoutubeUrl } from "@/lib/actions/exercise-videos";
import { findCatalogExercise } from "@/lib/exercise-catalog";
import {
  resolveExerciseGifUrls,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import { extractYoutubeId, isValidYoutubeUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-10 w-10 rounded-xl border border-border",
  md: "h-14 w-14 rounded-xl border border-border",
  lg: "h-16 w-16 rounded-xl border border-border",
  xl: "h-20 w-20 rounded-2xl border border-border sm:h-24 sm:w-24",
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
  const hasGif = Boolean(url || fallbackUrl);

  const explicitVideo =
    videoUrl && isValidYoutubeUrl(videoUrl) ? videoUrl.trim() : null;
  const [overrideVideo, setOverrideVideo] = useState<string | null>(null);
  const [gifFailed, setGifFailed] = useState(false);
  const [youtubeFailed, setYoutubeFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onGifFailed = useEffectEvent(() => {
    setGifFailed(true);
  });

  useEffect(() => {
    setGifFailed(false);
  }, [url, fallbackUrl, name]);

  useEffect(() => {
    setYoutubeFailed(false);
  }, [explicitVideo, overrideVideo]);

  useEffect(() => {
    if (explicitVideo || !name.trim()) {
      setOverrideVideo(null);
      return;
    }

    let cancelled = false;
    void resolveExerciseYoutubeUrl(name).then((resolved) => {
      if (cancelled) return;
      setOverrideVideo(
        resolved && isValidYoutubeUrl(resolved) ? resolved.trim() : null
      );
    });

    return () => {
      cancelled = true;
    };
  }, [name, explicitVideo]);

  const effectiveVideo = explicitVideo ?? overrideVideo;
  const youtubeThumb = useMemo(
    () => youtubeThumbnailUrl(effectiveVideo),
    [effectiveVideo]
  );
  const showYoutube = Boolean(youtubeThumb) && !youtubeFailed;
  const showGif = hasGif && !gifFailed && !showYoutube;
  const hasDemo =
    exerciseCanShowDemo(name, effectiveVideo ?? videoUrl, imageUrl) || hasGif;
  const sizeClass = SIZE_CLASS[size];
  const playIconClass =
    size === "sm"
      ? "h-2.5 w-2.5"
      : size === "xl"
        ? "h-4 w-4"
        : "h-3 w-3";
  const playBadgeClass =
    size === "sm" ? "h-5 w-5" : size === "xl" ? "h-8 w-8" : "h-6 w-6";
  const dumbbellClass =
    size === "sm" ? "h-4 w-4" : size === "xl" ? "h-7 w-7" : "h-5 w-5";

  const emptyPlaceholder = (
    <div
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        sizeClass,
        !expandable && className
      )}
    >
      <Dumbbell className={cn("opacity-40", dumbbellClass)} aria-hidden />
      <span className="sr-only">{name} demonstration</span>
    </div>
  );

  const youtubeMedia = youtubeThumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={youtubeThumb}
      alt={`${name} demonstration`}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setYoutubeFailed(true)}
    />
  ) : null;

  const gifMedia = showGif ? (
    <ExerciseGifImage
      gifUrl={url}
      fallbackUrl={fallbackUrl}
      alt={`${name} demonstration`}
      className={cn(sizeClass, !expandable && className)}
      onFailed={onGifFailed}
      hideOnFailed
    />
  ) : null;

  if (!expandable || !hasDemo) {
    if (showYoutube && youtubeThumb) {
      return (
        <div
          className={cn(
            "overflow-hidden bg-secondary/40",
            sizeClass,
            className
          )}
        >
          {youtubeMedia}
        </div>
      );
    }
    if (showGif && gifMedia) return gifMedia;
    return emptyPlaceholder;
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
          youtubeMedia
        ) : showGif ? (
          <ExerciseGifImage
            gifUrl={url}
            fallbackUrl={fallbackUrl}
            alt={`${name} demonstration`}
            className={sizeClass}
            onFailed={onGifFailed}
            hideOnFailed
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-secondary/60">
            <Dumbbell
              className={cn("opacity-40 text-muted-foreground", dumbbellClass)}
              aria-hidden
            />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/35">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-black/45 shadow-sm transition group-hover:scale-105 group-hover:bg-black/60",
              playBadgeClass
            )}
          >
            <Play
              className={cn(
                "fill-white text-white opacity-70 drop-shadow transition group-hover:opacity-100",
                playIconClass
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
        videoUrl={effectiveVideo ?? videoUrl}
        gender={resolvedGender}
      />
    </>
  );
}
