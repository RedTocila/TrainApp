"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  EXERCISE_CATALOG,
  formatCatalogLabel,
  getCatalogGifUrls,
  searchCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { useBodyUnits, usePlatformCopy } from "@/components/locale-provider";
import { resolveProfileGender, type ExerciseGender } from "@/lib/exercise-gif";
import {
  lookupExerciseHistory,
  useExerciseHistories,
} from "@/hooks/use-exercise-histories";
import { formatExerciseHistoryLabel } from "@/lib/exercise-history-format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

function CatalogExerciseCard({
  exercise,
  gender,
  previousLabel,
}: {
  exercise: CatalogExercise;
  gender?: ExerciseGender;
  previousLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { url: gifUrl, fallbackUrl } = getCatalogGifUrls(exercise, gender);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {gifUrl && (
            <ExerciseGifImage
              gifUrl={gifUrl}
              fallbackUrl={fallbackUrl}
              alt={`${exercise.name} demonstration`}
              className="h-20 w-20 shrink-0 rounded-lg border border-border"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-semibold">{exercise.name}</p>
            <p className="text-xs font-medium text-primary/90">{previousLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{formatCatalogLabel(exercise.category)}</Badge>
              {exercise.primary_muscles.slice(0, 2).map((muscle) => (
                <Badge key={muscle} variant="outline">
                  {formatCatalogLabel(muscle)}
                </Badge>
              ))}
              {gifUrl && (
                <Badge variant="outline" className="text-primary">
                  Demo
                </Badge>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <CardContent className="space-y-3 border-t border-border pt-0 pb-4">
          <ExerciseDemoPlayer
            name={exercise.name}
            imageUrl={gifUrl}
            fallbackImageUrl={fallbackUrl}
            videoUrl={exercise.video_url}
            gender={gender}
            autoplay
            resolveOverride
          />
          {exercise.description && (
            <p className="text-sm text-muted-foreground">{exercise.description}</p>
          )}
          {exercise.equipment.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Equipment:{" "}
              {exercise.equipment.map((item) => formatCatalogLabel(item)).join(", ")}
            </p>
          )}
          {exercise.instructions.length > 0 && (
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              {exercise.instructions.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function MyExercisesPage({
  gender,
}: {
  gender?: string | null;
}) {
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const resolvedGender = resolveProfileGender(gender);

  const filteredCatalog = useMemo(
    () =>
      searchCatalogExercises({
        query,
        category,
      }),
    [query, category]
  );

  const visibleCatalog = filteredCatalog.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCatalog.length;
  const catalogNames = useMemo(
    () => visibleCatalog.map((exercise) => exercise.name),
    [visibleCatalog]
  );
  const catalogHistories = useExerciseHistories(catalogNames);

  return (
    <div className="space-y-4">
      <Input
        placeholder={`Search ${EXERCISE_CATALOG.exercises.length} exercises…`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setCategory(undefined);
            setVisibleCount(PAGE_SIZE);
          }}
          className={cn(
            "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
            !category
              ? "border-white/10 bg-zinc-800/80 text-zinc-200"
              : "border-border/60 bg-secondary/50 text-zinc-500 hover:text-zinc-300"
          )}
        >
          All
        </button>
        {EXERCISE_CATALOG.categories.map((item) => {
          const active = category === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                setVisibleCount(PAGE_SIZE);
              }}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                active
                  ? "border-white/10 bg-zinc-800/80 text-zinc-200"
                  : "border-border/60 bg-secondary/50 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {formatCatalogLabel(item)}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {filteredCatalog.length} exercise
          {filteredCatalog.length === 1 ? "" : "s"}
          {category ? ` in ${formatCatalogLabel(category)}` : ""}
          {resolvedGender
            ? ` · ${resolvedGender === "male" ? "Male" : "Female"} demos`
            : ""}
        </p>
        <ul className="space-y-2">
          {visibleCatalog.map((exercise) => (
            <li key={exercise.id}>
              <CatalogExerciseCard
                exercise={exercise}
                gender={resolvedGender}
                previousLabel={formatExerciseHistoryLabel(
                  lookupExerciseHistory(catalogHistories, exercise.name),
                  platform.workout.lastSets,
                  units.unitSystem,
                  platform.workout.neverTried
                )}
              />
            </li>
          ))}
        </ul>
        {filteredCatalog.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No exercises match your search.
            </CardContent>
          </Card>
        )}
        {hasMore && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Load more ({filteredCatalog.length - visibleCount} remaining)
          </Button>
        )}
      </div>
    </div>
  );
}
