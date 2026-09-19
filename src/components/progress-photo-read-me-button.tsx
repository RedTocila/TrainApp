"use client";

import { BookOpen } from "lucide-react";
import { useProgressPhotoReadMe } from "@/components/progress-photo-read-me-context";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProgressPhotoReadMeButton({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const platform = usePlatformCopy();
  const { openReadMe } = useProgressPhotoReadMe();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 text-xs font-semibold", buttonClassName, className)}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        openReadMe();
      }}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {platform.photos.readMeButton}
    </Button>
  );
}
