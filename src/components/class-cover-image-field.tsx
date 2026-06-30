"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ClassCoverImageField({
  defaultUrl = "",
}: {
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [preview, setPreview] = useState<string | null>(defaultUrl?.trim() || null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (file: File | null) => {
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    if (!file) {
      setPreview(url.trim() || null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUrl("");
  };

  const handleUrlChange = (nextUrl: string) => {
    setUrl(nextUrl);
    if (!nextUrl.trim()) {
      setPreview(null);
      return;
    }
    setPreview(nextUrl.trim());
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="cover_image">Cover image</Label>
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
            <Label htmlFor="cover_image" className="text-xs text-muted-foreground">
              Image URL
            </Label>
            <Input
              id="cover_image"
              name="cover_image"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover_image_file" className="text-xs text-muted-foreground">
              Or upload image
            </Label>
            <Input
              id="cover_image_file"
              name="cover_image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Upload takes priority over URL. JPG, PNG, WebP, or GIF up to 5 MB.
          </p>
        </div>
      </div>
    </div>
  );
}
