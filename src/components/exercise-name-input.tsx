"use client";

import { useMemo, useState } from "react";
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

export function ExerciseNameInput({
  value,
  onChange,
  onSelect,
  gender,
  className,
  placeholder = "Search exercises…",
}: ExerciseNameInputProps) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const query = value.trim();
    if (query.length < 2) return [];
    return searchCatalogExercises({ query }).slice(0, 8);
  }, [value]);

  const showSuggestions =
    focused && suggestions.length > 0 && value.trim().length >= 2;

  const handleSelect = (exercise: CatalogExercise) => {
    const { url } = getCatalogGifUrls(exercise, gender);
    onSelect({ name: exercise.name, image_url: url });
    setFocused(false);
  };

  return (
    <div className={cn("relative", className)}>
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
      {showSuggestions ? (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.map((exercise) => {
            const { url: gifUrl, fallbackUrl } = getCatalogGifUrls(exercise, gender);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(exercise)}
                >
                  {gifUrl ? (
                    <ExerciseGifImage
                      gifUrl={gifUrl}
                      fallbackUrl={fallbackUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      No gif
                    </span>
                  )}
                  <span className="min-w-0 flex-1 capitalize leading-snug">
                    {formatCatalogLabel(exercise.name)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
