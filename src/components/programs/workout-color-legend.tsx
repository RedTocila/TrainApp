"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import {
  countWorkoutsByCategory,
  getWorkoutCategoryStyle,
  WORKOUT_FILTER_CATEGORIES,
  type WorkoutCategoryFilter,
} from "@/lib/workout-visual-categories";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { cn } from "@/lib/utils";

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  style,
  alwaysShowCount = false,
}: {
  active: boolean;
  onClick: (el: HTMLButtonElement | null) => void;
  label: string;
  count: number;
  icon?: React.ComponentType<{ className?: string }>;
  style?: ReturnType<typeof getWorkoutCategoryStyle>;
  alwaysShowCount?: boolean;
}) {
  const showCount = alwaysShowCount || count > 0;

  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 snap-start flex-col items-center gap-1 px-2 py-1 transition-all",
        active ? "scale-105" : "opacity-75 hover:opacity-100",
        !active && count === 0 && !alwaysShowCount && "opacity-40"
      )}
    >
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-[18px] border-2 transition-shadow",
          style ? cn(style.chip, style.chipText) : "border-border bg-secondary/60 text-muted-foreground",
          active && "shadow-lg ring-2 ring-white/25 ring-offset-2 ring-offset-background"
        )}
      >
        {Icon ? (
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <LayoutGrid className="h-[18px] w-[18px]" aria-hidden />
        )}
        {showCount && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-black text-white",
              style?.stripe ?? "bg-primary"
            )}
          >
            {count}
          </span>
        )}
      </span>
      <span
        className={cn(
          "max-w-[3.5rem] truncate text-[10px] font-bold leading-none",
          active ? (style?.chipText ?? "text-foreground") : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function WorkoutCategoryFilter({
  workouts,
  selected,
  onSelectedChange,
  className,
}: {
  workouts: PersonalWorkoutListItem[];
  selected: WorkoutCategoryFilter;
  onSelectedChange: (category: WorkoutCategoryFilter) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const counts = countWorkoutsByCategory(workouts);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollHints();
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
  }, [updateScrollHints, workouts.length]);

  const scrollBy = () => {
    scrollRef.current?.scrollBy({ left: 120, behavior: "smooth" });
  };

  const selectCategory = (category: WorkoutCategoryFilter, button: HTMLButtonElement | null) => {
    onSelectedChange(category);
    button?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className={cn("relative -mx-1", className)}>
      {canScrollRight && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={scrollBy}
            className="absolute right-0 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-card/95 text-foreground shadow-md backdrop-blur-sm sm:flex"
            aria-label="Scroll categories right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "flex gap-0.5 overflow-x-auto py-1 pl-1",
          canScrollRight ? "pr-6 sm:pr-10" : "pr-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        )}
        role="tablist"
        aria-label="Filter workouts by type"
      >
        <FilterChip
          active={selected === "all"}
          onClick={(el) => selectCategory("all", el)}
          label="All"
          count={counts.all}
          alwaysShowCount
        />

        {WORKOUT_FILTER_CATEGORIES.map((category) => {
          const style = getWorkoutCategoryStyle(category);
          const Icon = style.icon;
          return (
            <FilterChip
              key={category}
              active={selected === category}
              onClick={(el) => selectCategory(category, el)}
              label={style.shortLabel}
              count={counts[category]}
              icon={Icon}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use WorkoutCategoryFilter */
export function WorkoutColorLegend({ className }: { className?: string }) {
  return (
    <WorkoutCategoryFilter
      workouts={[]}
      selected="all"
      onSelectedChange={() => {}}
      className={className}
    />
  );
}
