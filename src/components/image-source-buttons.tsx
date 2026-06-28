"use client";

import { useRef } from "react";
import { Camera, ImageIcon, ImagePlus } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageSourceButtonsProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  layout?: "row" | "icons" | "icon" | "zone" | "button";
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
  const resolvedGalleryLabel = galleryLabel ?? platform.mealLog.changePhoto;
  const resolvedZoneLabel =
    zoneLabel ?? (cameraOnly ? resolvedCameraLabel : platform.mealLog.addMealPhoto);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = (file: File | undefined) => {
    if (file) onSelect(file);
    resetInput(cameraRef.current);
    resetInput(galleryRef.current);
  };

  const cameraInput = (
    <input
      ref={cameraRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      disabled={disabled}
      onChange={(e) => handleChange(e.target.files?.[0])}
    />
  );

  const galleryInput = cameraOnly ? null : (
    <input
      ref={galleryRef}
      type="file"
      accept="image/*"
      className="hidden"
      disabled={disabled}
      onChange={(e) => handleChange(e.target.files?.[0])}
    />
  );

  if (layout === "zone") {
    return (
      <>
        {cameraInput}
        {galleryInput}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            cameraOnly ? cameraRef.current?.click() : galleryRef.current?.click()
          }
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
        {galleryInput}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            cameraOnly ? cameraRef.current?.click() : galleryRef.current?.click()
          }
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
        {galleryInput}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
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
            onClick={() => galleryRef.current?.click()}
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
        {galleryInput}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-9 w-9", className)}
          disabled={disabled}
          onClick={() =>
            cameraOnly ? cameraRef.current?.click() : galleryRef.current?.click()
          }
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
      {galleryInput}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
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
          onClick={() => galleryRef.current?.click()}
        >
          <ImageIcon className="mr-1.5 h-4 w-4" />
          {resolvedGalleryLabel}
        </Button>
      ) : null}
    </div>
  );
}
