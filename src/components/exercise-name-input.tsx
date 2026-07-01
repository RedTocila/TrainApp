"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatCatalogLabel,
  getCatalogGifUrls,
  searchCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import type { ExerciseGender } from "@/lib/exercise-gif";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ExerciseNameInputProps = {
  value: string;
  onChange: (name: string) => void;
  onSelect: (exercise: { name: string; image_url: string | null }) => void;
  gender?: ExerciseGender;
  className?: string;
  placeholder?: string;
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

export function ExerciseNameInput({
  value,
  onChange,
  onSelect,
  gender,
  className,
  placeholder = "Search exercises…",
}: ExerciseNameInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const suggestions = useMemo(() => {
    const query = value.trim();
    if (query.length < 2) return [];
    return searchCatalogExercises({ query }).slice(0, 8);
  }, [value]);

  const showSuggestions =
    focused && suggestions.length > 0 && value.trim().length >= 2;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showSuggestions || !containerRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showSuggestions, value]);

  const handleSelect = (exercise: CatalogExercise) => {
    const { url } = getCatalogGifUrls(exercise, gender);
    onSelect({ name: exercise.name, image_url: url });
    setFocused(false);
  };

  const dropdown =
    showSuggestions && position && mounted ? (
      <ul
        className="fixed z-[200] max-h-80 overflow-auto rounded-xl border border-border bg-card shadow-2xl ring-1 ring-black/10"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
      >
        {suggestions.map((exercise) => {
          const { url: gifUrl, fallbackUrl } = getCatalogGifUrls(exercise, gender);
          return (
            <li key={exercise.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(exercise)}
              >
                {gifUrl ? (
                  <ExerciseGifImage
                    gifUrl={gifUrl}
                    fallbackUrl={fallbackUrl}
                    alt={`${exercise.name} demonstration`}
                    className="h-11 w-11 shrink-0 rounded-lg border border-border bg-white"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                    No gif
                  </span>
                )}
                <span className="min-w-0 flex-1 capitalize leading-snug text-foreground">
                  {formatCatalogLabel(exercise.name)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <>
      <div ref={containerRef} className={cn("relative", className)}>
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 150);
          }}
          autoComplete="off"
        />
      </div>
      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </>
  );
}
