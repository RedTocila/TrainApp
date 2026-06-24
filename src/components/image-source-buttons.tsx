"use client";

import { useRef } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageSourceButtonsProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  layout?: "row" | "icons";
  cameraLabel?: string;
  galleryLabel?: string;
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
  className,
}: ImageSourceButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = (file: File | undefined) => {
    if (file) onSelect(file);
    resetInput(cameraRef.current);
    resetInput(galleryRef.current);
  };

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
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleChange(e.target.files?.[0])}
      />
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
