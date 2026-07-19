"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CoverImageField({
  defaultUrl = "",
  fallbackPreviewUrl = "",
  label = "Cover image",
}: {
  defaultUrl?: string | null;
  /** Shown when no saved cover exists (not persisted unless a file is uploaded). */
  fallbackPreviewUrl?: string | null;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initialFallback = fallbackPreviewUrl?.trim() || "";
  const [keptUrl, setKeptUrl] = useState(defaultUrl ?? "");
  const [preview, setPreview] = useState<string | null>(
    defaultUrl?.trim() || initialFallback || null
  );
  const [clearCover, setClearCover] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const displayForKept = (url: string) => url.trim() || initialFallback || null;

  const handleFileChange = (file: File | null) => {
    setClearCover(false);
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    if (!file) {
      setPreview(displayForKept(keptUrl));
      return;
    }
    setKeptUrl("");
    setPreview(URL.createObjectURL(file));
  };

  const handleClear = () => {
    if (fileRef.current) fileRef.current.value = "";
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setKeptUrl("");
    setPreview(null);
    setClearCover(true);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="cover_image_file">{label}</Label>
      <input type="hidden" name="cover_image" value={keptUrl} />
      {clearCover ? <input type="hidden" name="cover_image_clear" value="on" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 sm:h-32 sm:w-44",
            preview && "bg-black/5"
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cover_image_file" className="text-xs text-muted-foreground">
              Upload image
            </Label>
            <Input
              ref={fileRef}
              id="cover_image_file"
              name="cover_image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Choose file
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleClear}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP, or GIF up to 5 MB.
          </p>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer CoverImageField */
export const ClassCoverImageField = CoverImageField;
