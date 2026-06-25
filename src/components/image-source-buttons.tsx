"use client";

import { useRef } from "react";
import { Camera, ImageIcon, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageSourceButtonsProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  layout?: "row" | "icons" | "icon" | "zone" | "button";
  cameraLabel?: string;
  galleryLabel?: string;
  zoneLabel?: string;
  className?: string;
};

function resetInput(input: HTMLInputElement | null) {
  if (input) input.value = "";
}

export function ImageSourceButtons({
  onSelect,
  disabled = false,
  layout = "row",
  cameraLabel = "Take photo",
  galleryLabel = "Gallery",
  zoneLabel = "Add meal photo",
  className,
}: ImageSourceButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = (file: File | undefined) => {
    if (file) onSelect(file);
    resetInput(cameraRef.current);
    resetInput(galleryRef.current);
  };

  const galleryInput = (
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
        {galleryInput}
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          aria-label={zoneLabel}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-10 transition-colors",
            "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <ImagePlus className="h-10 w-10 text-primary" strokeWidth={1.75} />
          <span className="text-sm font-medium text-muted-foreground">{zoneLabel}</span>
        </button>
      </>
    );
  }

  if (layout === "button") {
    return (
      <>
        {galleryInput}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className={className}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" />
          {galleryLabel}
        </Button>
      </>
    );
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleChange(e.target.files?.[0])}
      />
      {galleryInput}
    </>
  );

  if (layout === "icons") {
    return (
      <div className={cn("flex items-center justify-center gap-1.5", className)}>
        {inputs}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          aria-label={cameraLabel}
        >
          <Camera className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          aria-label={galleryLabel}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (layout === "icon") {
    return (
      <>
        {galleryInput}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-9 w-9", className)}
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          aria-label={galleryLabel}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
      </>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {inputs}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="mr-1.5 h-4 w-4" />
        {cameraLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
      >
        <ImageIcon className="mr-1.5 h-4 w-4" />
        {galleryLabel}
      </Button>
    </div>
  );
}
