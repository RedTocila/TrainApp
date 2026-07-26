"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Pencil, Trash2 } from "lucide-react";
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }

    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 144;
      const padding = 8;
      const left = Math.min(
        Math.max(padding, rect.left),
        window.innerWidth - menuWidth - padding
      );
      setMenuPos({
        top: rect.bottom + 4,
        left,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[80] min-w-[9rem] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
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
              <Camera className="h-3.5 w-3.5 shrink-0" />
              {platform.photos.retake}
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("absolute left-1.5 top-1.5 z-20", className)}>
      <button
        ref={buttonRef}
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
      {menu}
    </div>
  );
}
