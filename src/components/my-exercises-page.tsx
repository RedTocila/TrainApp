"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Dumbbell, ExternalLink } from "lucide-react";
import type { PersonalExerciseLibraryItem } from "@/lib/actions/user-workouts";
import {
  EXERCISE_CATALOG,
  formatCatalogLabel,
  searchCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

type Tab = "library" | "mine";

function CatalogExerciseCard({ exercise }: { exercise: CatalogExercise }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{exercise.name}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{formatCatalogLabel(exercise.category)}</Badge>
            {exercise.primary_muscles.slice(0, 2).map((muscle) => (
              <Badge key={muscle} variant="outline">
                {formatCatalogLabel(muscle)}
              </Badge>
            ))}
            {exercise.video && (
              <Badge variant="outline" className="text-primary">
                Video
              </Badge>
            )}
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
          <ExerciseVideoPlayer videoUrl={exercise.video} title={exercise.name} />
        </CardContent>
      )}
    </Card>
  );
}

function MyWorkoutExercises({
  exercises,
  query,
}: {
  exercises: PersonalExerciseLibraryItem[];
  query: string;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.planTitle.toLowerCase().includes(q) ||
        item.dayTitle.toLowerCase().includes(q)
    );
  }, [exercises, query]);

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No exercises in your workouts yet</p>
          <p className="text-sm text-muted-foreground">
            Add exercises from the library when building a workout.
          </p>
          <Link href="/dashboard/workout" className="text-sm font-medium text-primary hover:underline">
            Go to My Workouts
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {filtered.map((item) => (
        <li key={`${item.planId}-${item.id}`}>
          <Link href={`/dashboard/workout/${item.planId}/edit`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.planTitle} · {item.dayTitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.sets != null && <Badge variant="secondary">{item.sets} sets</Badge>}
                  {item.reps != null && <Badge variant="outline">{item.reps} reps</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MyExercisesPage({
  initialExercises,
}: {
  initialExercises: PersonalExerciseLibraryItem[];
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-xl bg-secondary/50 p-1">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            tab === "library"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Library ({EXERCISE_CATALOG.exercises.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            tab === "mine"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          My workouts ({initialExercises.length})
        </button>
      </div>

      <Input
        placeholder={tab === "library" ? "Search 872 exercises…" : "Search your exercises…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
      />

      {tab === "library" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={category ? "outline" : "secondary"}
            onClick={() => {
              setCategory(undefined);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            All
          </Button>
          {EXERCISE_CATALOG.categories.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? "secondary" : "outline"}
              onClick={() => {
                setCategory(item);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              {formatCatalogLabel(item)}
            </Button>
          ))}
        </div>
      )}

      {tab === "library" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {filteredCatalog.length} exercise{filteredCatalog.length === 1 ? "" : "s"}
            {category ? ` in ${formatCatalogLabel(category)}` : ""}
          </p>
          <ul className="space-y-2">
            {visibleCatalog.map((exercise) => (
              <li key={exercise.name}>
                <CatalogExerciseCard exercise={exercise} />
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
          <p className="text-center text-[11px] text-muted-foreground">
            Exercise data from{" "}
            <a
              href={EXERCISE_CATALOG.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              exercemus/exercises
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      ) : (
        <MyWorkoutExercises exercises={initialExercises} query={query} />
      )}
    </div>
  );
}
