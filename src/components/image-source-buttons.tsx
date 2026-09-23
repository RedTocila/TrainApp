"use client";

import { useRef } from "react";
import { Camera, ImageIcon, ImagePlus } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/native-app";
import { pickNativeImage } from "@/lib/native-camera";
import { pickGalleryImage } from "@/lib/pick-gallery-image";
import { cn } from "@/lib/utils";

type ImageSourceButtonsProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  layout?: "row" | "icons" | "icon" | "zone" | "button" | "tiles";
  cameraLabel?: string;
  galleryLabel?: string;
  zoneLabel?: string;
  /** When true, only opens the device camera — no gallery picker. */
  cameraOnly?: boolean;
  className?: string;
};

function resetInput(input: HTMLInputElement | null) {
  if (input) input.value = "";
}

export function ImageSourceButtons({
  onSelect,
  disabled = false,
  layout = "row",
  cameraLabel,
  galleryLabel,
  zoneLabel,
  cameraOnly = false,
  className,
}: ImageSourceButtonsProps) {
  const platform = usePlatformCopy();
  const resolvedCameraLabel = cameraLabel ?? platform.mealLog.takePhoto;
  const resolvedGalleryLabel = galleryLabel ?? platform.mealLog.fromGallery;
  const resolvedZoneLabel =
    zoneLabel ?? (cameraOnly ? resolvedCameraLabel : platform.mealLog.addMealPhoto);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleCameraChange = (file: File | undefined) => {
    if (file) onSelect(file);
    resetInput(cameraRef.current);
  };

  const openCamera = () => {
    if (isNativeApp()) {
      void (async () => {
        try {
          const native = await pickNativeImage({ source: "camera" });
          if (native) {
            onSelect(native);
            return;
          }
        } catch {
          // User cancelled or plugin failed.
        }
      })();
      return;
    }
    cameraRef.current?.click();
  };

  const openGallery = () => {
    if (isNativeApp()) {
      void (async () => {
        try {
          const native = await pickNativeImage({ source: "gallery" });
          if (native) onSelect(native);
        } catch {
          // User cancelled or plugin failed.
        }
      })();
      return;
    }

    // Web: keep picker open inside the originating click (no await first).
    void pickGalleryImage().then((file) => {
      if (file) onSelect(file);
    });
  };

  const cameraInput = (
    <input
      ref={cameraRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="pointer-events-none absolute h-px w-px opacity-0"
      disabled={disabled}
      onChange={(e) => handleCameraChange(e.target.files?.[0])}
    />
  );

  if (layout === "tiles") {
    const tileClass = cn(
      "relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 p-4 text-center transition-colors",
      "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      "disabled:cursor-not-allowed disabled:opacity-50"
    );

    return (
      <div
        className={cn(
          "grid gap-3",
          cameraOnly ? "grid-cols-1" : "grid-cols-2",
          className
        )}
      >
        {cameraInput}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void openCamera()}
          className={tileClass}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Camera className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-semibold leading-tight">
            {resolvedCameraLabel}
          </span>
        </button>
        {!cameraOnly ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void openGallery()}
            className={tileClass}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-foreground">
              <ImageIcon className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-semibold leading-tight">
              {resolvedGalleryLabel}
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  if (layout === "zone") {
    return (
      <>
        {cameraInput}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void (cameraOnly ? openCamera() : openGallery())}
          aria-label={resolvedZoneLabel}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-10 transition-colors",
            "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          {cameraOnly ? (
            <Camera className="h-10 w-10 text-primary" strokeWidth={1.75} />
          ) : (
            <ImagePlus className="h-10 w-10 text-primary" strokeWidth={1.75} />
          )}
          <span className="text-sm font-medium text-muted-foreground">{resolvedZoneLabel}</span>
        </button>
      </>
    );
  }

  if (layout === "button") {
    return (
      <>
        {cameraInput}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => void (cameraOnly ? openCamera() : openGallery())}
          className={className}
        >
          {cameraOnly ? (
            <Camera className="mr-1.5 h-4 w-4" />
          ) : (
            <ImagePlus className="mr-1.5 h-4 w-4" />
          )}
          {cameraOnly ? resolvedCameraLabel : resolvedGalleryLabel}
        </Button>
      </>
    );
  }

  if (layout === "icons") {
    return (
      <div className={cn("flex items-center justify-center gap-1.5", className)}>
        {cameraInput}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => void openCamera()}
          aria-label={resolvedCameraLabel}
        >
          <Camera className="h-3.5 w-3.5" />
        </Button>
        {!cameraOnly ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={() => void openGallery()}
            aria-label={resolvedGalleryLabel}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    );
  }

  if (layout === "icon") {
    return (
      <>
        {cameraInput}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-9 w-9", className)}
          disabled={disabled}
          onClick={() => void (cameraOnly ? openCamera() : openGallery())}
          aria-label={cameraOnly ? resolvedCameraLabel : resolvedGalleryLabel}
        >
          {cameraOnly ? (
            <Camera className="h-4 w-4" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </Button>
      </>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {cameraInput}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={disabled}
        onClick={() => void openCamera()}
      >
        <Camera className="mr-1.5 h-4 w-4" />
        {resolvedCameraLabel}
      </Button>
      {!cameraOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={disabled}
          onClick={() => void openGallery()}
        >
          <ImageIcon className="mr-1.5 h-4 w-4" />
          {resolvedGalleryLabel}
        </Button>
      ) : null}
    </div>
  );
}
