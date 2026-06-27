"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, Flame, Plus, Salad, Trash2, UtensilsCrossed, Apple } from "lucide-react";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboard, DashboardSectionHeading } from "@/components/dashboard-ui";

const MEAL_ICONS = [Salad, Apple, UtensilsCrossed] as const;

function mealIcon(index: number) {
  return MEAL_ICONS[index % MEAL_ICONS.length];
}

export function RecentMealsList({
  meals,
  onDelete,
  onSelect,
  onAdd,
  isPending,
  title,
  emptyHint,
  showHeaderAdd = true,
  variant = "card",
  collapsible = true,
}: {
  meals: DailyMealLog[];
  onDelete?: (id: string) => void;
  onSelect?: (meal: DailyMealLog) => void;
  onAdd?: () => void;
  isPending?: boolean;
  title?: string;
  emptyHint?: string;
  showHeaderAdd?: boolean;
  variant?: "card" | "flat" | "feed";
  collapsible?: boolean;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(variant === "flat" || variant === "feed" || !collapsible);
  const resolvedTitle =
    title ??
    (variant === "feed" ? platform.nutrition.recentlyUploaded : platform.nutrition.recentlyLogged);
  const resolvedEmptyHint = emptyHint ?? coachLabels.logFirstMeal;
  const flat = variant === "flat";
  const feed = variant === "feed";
  const expanded = !collapsible || open;

  if (meals.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-primary/30 hover:bg-card",
          dashboard.empty,
          feed && dashboard.tile
        )}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Salad className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{resolvedTitle}</p>
          <p className="text-xs text-muted-foreground">{resolvedEmptyHint}</p>
        </div>
        {onAdd && (
          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
            <Plus className="h-4 w-4" />
          </div>
        )}
      </button>
    );
  }

  if (feed) {
    return (
      <div className="space-y-3">
        <DashboardSectionHeading>{resolvedTitle}</DashboardSectionHeading>
        <ul className="space-y-2">
          {meals.map((meal, index) => {
            const Icon = mealIcon(index);
            const interactive = Boolean(onSelect);
            const loggedTime = meal.logged_at
              ? format(parseISO(meal.logged_at), "h:mm a")
              : null;

            return (
              <li key={meal.id}>
                <div
                  className={cn(
                    dashboard.listRow,
                    interactive && "cursor-pointer hover:bg-card"
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => onSelect?.(meal)}
                    disabled={!interactive}
                    aria-label={interactive ? platform.aria.mealInsights(meal.name) : undefined}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/80">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{meal.name}</span>
                        {loggedTime ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {loggedTime}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm font-bold tabular-nums">
                        <Flame className="h-3.5 w-3.5 text-orange-400" />
                        {Math.round(meal.calories)} {platform.nutrition.caloriesUnit}
                      </p>
                    </div>
                  </button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(meal.id);
                      }}
                      aria-label={platform.aria.removeMeal(meal.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div
      className={cn(
        flat ? "space-y-2" : "overflow-hidden rounded-2xl border border-border bg-secondary/20"
      )}
    >
      <div className={cn("flex items-center gap-2", flat ? "px-1" : "px-3 py-3 sm:px-4")}>
        {flat || !collapsible ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Salad className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-bold">{resolvedTitle}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {meals.length}
            </Badge>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={open}
          >
            <Salad className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-bold">{resolvedTitle}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {meals.length}
            </Badge>
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {showHeaderAdd && onAdd && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              {platform.common.add}
            </Button>
          )}
          {!flat && collapsible && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={open ? platform.aria.collapseMeals : platform.aria.expandMeals}
            >
              <ChevronDown
                className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
              />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className={cn(
            "space-y-2",
            flat ? "px-1" : "border-t border-border px-3 pb-3 pt-2 sm:px-4 sm:pb-4"
          )}
        >
          <ul className="space-y-2">
            {meals.map((meal, index) => {
              const Icon = mealIcon(index);
              const summary = formatMealMacrosSummary(normalizeMealMacros(meal));
              const interactive = Boolean(onSelect);

              return (
                <li key={meal.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-3",
                      interactive &&
                        "cursor-pointer transition-colors hover:border-primary/30 hover:bg-secondary/50"
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => onSelect?.(meal)}
                      disabled={!interactive}
                      aria-label={interactive ? platform.aria.mealInsights(meal.name) : undefined}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{meal.name}</span>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] capitalize">
                            {meal.meal_type}
                          </Badge>
                        </div>
                        {summary && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
                        )}
                      </div>
                    </button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                        disabled={isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(meal.id);
                        }}
                        aria-label={platform.aria.removeMeal(meal.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
