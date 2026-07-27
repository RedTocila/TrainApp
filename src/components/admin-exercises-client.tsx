"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { Search, PlaySquare, Check, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isValidYoutubeUrl } from "@/lib/youtube";
import { saveExerciseVideoUrl } from "@/lib/actions/admin-exercises";
import type { AdminExerciseRow } from "@/lib/actions/admin-exercises";

interface Props {
  exercises: AdminExerciseRow[];
  categories: string[];
}

function ExerciseVideoRow({ ex }: { ex: AdminExerciseRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ex.youtube_url ?? "");
  const [saved, setSaved] = useState(ex.youtube_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const valid = !value.trim() || isValidYoutubeUrl(value.trim());

  const handleSave = useCallback(() => {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const res = await saveExerciseVideoUrl(ex.id, value);
      if (res.ok) {
        setSaved(value.trim());
        setEditing(false);
      } else {
        setError(res.error);
      }
    });
  }, [ex.id, valid, value]);

  const handleCancel = () => {
    setValue(saved);
    setError(null);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      {/* Left — exercise info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{ex.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{ex.category}</span>
          {ex.body_parts.slice(0, 3).map((bp) => (
            <Badge
              key={bp}
              variant="secondary"
              className="h-4 px-1.5 py-0 text-[10px] leading-none"
            >
              {bp}
            </Badge>
          ))}
        </div>
      </div>

      {/* Right — video input or status */}
      <div className="flex shrink-0 items-center gap-2 sm:w-80">
        {editing ? (
          <>
            <div className="relative flex-1">
              <PlaySquare className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className={cn(
                  "h-8 pl-7 text-xs",
                  !valid && "border-destructive focus-visible:ring-destructive"
                )}
                placeholder="https://youtube.com/watch?v=..."
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!valid || isPending}
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
            onClick={() => setEditing(true)}
          >
            <PlaySquare
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                saved ? "text-red-500" : "text-muted-foreground"
              )}
            />
            {saved ? (
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {saved}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Add video link</span>
            )}
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        )}
      </div>
      {error && (
        <p className="w-full text-xs text-destructive sm:col-span-full">{error}</p>
      )}
    </div>
  );
}

export function AdminExercisesClient({ exercises, categories }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [withVideoOnly, setWithVideoOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = exercises;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (ex) =>
          ex.name.toLowerCase().includes(q) ||
          ex.category.toLowerCase().includes(q) ||
          ex.body_parts.some((b) => b.toLowerCase().includes(q))
      );
    }
    if (category !== "all") {
      list = list.filter((ex) => ex.category === category);
    }
    if (withVideoOnly) {
      list = list.filter((ex) => Boolean(ex.youtube_url));
    }
    return list;
  }, [exercises, search, category, withVideoOnly]);

  const withVideoCount = useMemo(
    () => exercises.filter((ex) => Boolean(ex.youtube_url)).length,
    [exercises]
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button
          onClick={() => setWithVideoOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
            withVideoOnly
              ? "border-red-500 bg-red-500/10 text-red-500"
              : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          <PlaySquare className="h-4 w-4" />
          With video ({withVideoCount})
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
        {withVideoOnly || category !== "all" || search ? " matching filters" : ""}
      </p>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No exercises match your filters.
          </div>
        ) : (
          filtered.map((ex) => <ExerciseVideoRow key={ex.id} ex={ex} />)
        )}
      </div>
    </div>
  );
}
