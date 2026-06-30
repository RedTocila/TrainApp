"use client";

import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { ExerciseDemoDialog } from "@/components/exercise-demo-dialog";
import {
  resolveExerciseGifUrls,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-10 w-10 rounded-lg border border-border",
  md: "h-12 w-12 rounded-lg border border-border",
  lg: "h-16 w-16 rounded-lg border border-border",
} as const;

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasDemo = !!url || !!videoUrl?.trim();
  const sizeClass = SIZE_CLASS[size];

  const image = (
    <ExerciseGifImage
      gifUrl={url}
      fallbackUrl={fallbackUrl}
      alt={`${name} demonstration`}
      className={cn(sizeClass, !expandable && className)}
    />
  );

  if (!expandable || !hasDemo) {
    return image;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "group relative shrink-0 overflow-hidden ring-offset-background transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sizeClass,
          className
        )}
        aria-label={`Preview ${name}`}
      >
        <ExerciseGifImage
          gifUrl={url}
          fallbackUrl={fallbackUrl}
          alt={`${name} demonstration`}
          className={sizeClass}
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
          <Play className="h-4 w-4 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
        </span>
      </button>
      <ExerciseDemoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        name={name}
        imageUrl={imageUrl ?? url}
        videoUrl={videoUrl}
        gender={resolvedGender}
      />
    </>
  );
}
