"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export function ProgressPhotoEditMenu({
  label,
  disabled = false,
  onPick,
  onRemove,
  className,
}: {
  label: string;
  disabled?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  className?: string;
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("absolute left-1.5 top-1.5 z-20", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label={platform.photos.editPhoto(label)}
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 disabled:opacity-50"
      >
        <Pencil className="h-3 w-3" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
              if (fileRef.current) fileRef.current.value = "";
              setOpen(false);
            }}
          />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-secondary/80"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5 shrink-0" />
            {platform.photos.replace}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {platform.photos.deletePhoto}
          </button>
        </div>
      ) : null}
    </div>
  );
}
