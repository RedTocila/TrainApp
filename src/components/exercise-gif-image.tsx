"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Dumbbell } from "lucide-react";
import { toExerciseGifProxyUrl } from "@/lib/exercise-gif-proxy";
import { cn } from "@/lib/utils";

interface ExerciseGifImageProps {
  gifUrl?: string | null;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Called once when every GIF source fails (or none were provided). */
  onFailed?: () => void;
  /** When true, render nothing on failure so a parent can show another fallback. */
  hideOnFailed?: boolean;
}

export function ExerciseGifImage({
  gifUrl,
  fallbackUrl,
  alt,
  className,
  imgClassName,
  onFailed,
  hideOnFailed = false,
}: ExerciseGifImageProps) {
  const [src, setSrc] = useState<string | null>(
    toExerciseGifProxyUrl(gifUrl) ?? gifUrl?.trim() ?? null
  );
  const [failed, setFailed] = useState(false);

  const notifyFailed = useEffectEvent(() => {
    onFailed?.();
  });

  useEffect(() => {
    const next = toExerciseGifProxyUrl(gifUrl) ?? gifUrl?.trim() ?? null;
    setSrc(next);
    setFailed(false);
    if (!next) notifyFailed();
  }, [gifUrl, fallbackUrl]);

  if (!src || failed) {
    if (hideOnFailed) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
      >
        <Dumbbell className="h-5 w-5 opacity-40" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-contain", imgClassName)}
        loading="lazy"
        decoding="async"
        onError={() => {
          const next = toExerciseGifProxyUrl(fallbackUrl) ?? fallbackUrl?.trim();
          if (next && next !== src) {
            setSrc(next);
            return;
          }
          setFailed(true);
          notifyFailed();
        }}
      />
    </div>
  );
}
