"use client";

import { Play } from "lucide-react";
import {
  getWorkoutCategoryStyle,
  inferDayCategory,
  type WorkoutCategory,
} from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";

export function WorkoutDayChip({
  day,
  compact = false,
}: {
  day: { title: string; exercises?: { name: string }[] | null };
  compact?: boolean;
}) {
  const category = inferDayCategory(day);
  const style = getWorkoutCategoryStyle(category);
  const Icon = style.icon;
  const exerciseCount = day.exercises?.length ?? 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5",
        style.chip,
        style.chipText
      )}
      title={`${style.label} · ${day.title}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!compact && <span className="max-w-[5.5rem] truncate text-[11px] font-semibold">{day.title}</span>}
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold opacity-80">
        <Play className="h-2.5 w-2.5" />
        {exerciseCount}
      </span>
    </span>
  );
}

export function WorkoutCategoryIcon({
  category,
  size = "md",
}: {
  category: WorkoutCategory;
  size?: "sm" | "md" | "lg";
}) {
  const style = getWorkoutCategoryStyle(category);
  const Icon = style.icon;
  const sizeClass =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconClass = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl border-2",
        sizeClass,
        style.chip,
        style.chipText
      )}
      title={style.label}
      aria-label={style.label}
    >
      <Icon className={iconClass} aria-hidden />
    </span>
  );
}
