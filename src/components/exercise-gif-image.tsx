"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { toExerciseGifProxyUrl } from "@/lib/exercise-gif-proxy";
import { cn } from "@/lib/utils";

interface ExerciseGifImageProps {
  gifUrl?: string | null;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export function ExerciseGifImage({
  gifUrl,
  fallbackUrl,
  alt,
  className,
  imgClassName,
}: ExerciseGifImageProps) {
  const [src, setSrc] = useState<string | null>(
    toExerciseGifProxyUrl(gifUrl) ?? gifUrl?.trim() ?? null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(toExerciseGifProxyUrl(gifUrl) ?? gifUrl?.trim() ?? null);
    setFailed(false);
  }, [gifUrl, fallbackUrl]);

  if (!src || failed) {
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
        }}
      />
    </div>
  );
}
