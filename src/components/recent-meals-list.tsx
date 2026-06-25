"use client";

import { Apple, Plus, Salad, Trash2, UtensilsCrossed } from "lucide-react";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import type { DailyMealLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  title = "Recently logged",
  emptyHint = "Tap + to log your first meal",
  showHeaderAdd = true,
}: {
  meals: DailyMealLog[];
  onDelete?: (id: string) => void;
  onSelect?: (meal: DailyMealLog) => void;
  onAdd?: () => void;
  isPending?: boolean;
  title?: string;
  emptyHint?: string;
  showHeaderAdd?: boolean;
}) {
  if (meals.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-border bg-secondary/20 p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary/40"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Salad className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </div>
        {onAdd && (
          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
            <Plus className="h-4 w-4" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {showHeaderAdd && onAdd && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </div>
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
                  aria-label={interactive ? `View insights for ${meal.name}` : undefined}
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
                    aria-label={`Remove ${meal.name}`}
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
