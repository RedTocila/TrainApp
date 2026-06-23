"use client";

import { Check, Clock } from "lucide-react";
import { useTransition } from "react";
import { togglePlannedMealSlot } from "@/lib/actions/daily-meals";
import {
  canToggleMealSlot,
  type PlannedMealSlot,
} from "@/lib/meal-times";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MealPlanChecklist({
  clientId,
  dateKey,
  slots,
  onMealsChange,
}: {
  clientId: string;
  dateKey: string;
  slots: PlannedMealSlot[];
  onMealsChange: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const canToggle = canToggleMealSlot(dateKey);

  if (slots.length === 0) return null;

  const handleAte = (entry: PlannedMealSlot) => {
    if (!entry.meal || !canToggle) return;
    startTransition(async () => {
      const result = await togglePlannedMealSlot(
        clientId,
        dateKey,
        entry.slot,
        entry.meal!
      );
      if (result.error) return;
      onMealsChange();
    });
  };

  return (
    <ul className="space-y-2">
      {slots.map((entry) => {
        const { slot, label, meal, timeWindow, status } = entry;
        const isCompleted = status === "completed";
        const isMissed = status === "missed";
        const macros = meal
          ? formatMealMacrosSummary(normalizeMealMacros(meal))
          : null;

        return (
          <li
            key={slot}
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg border px-3 py-3",
              isMissed && "border-red-500/40 bg-red-500/10",
              isCompleted && "border-green-500/40 bg-green-500/10",
              !isMissed && !isCompleted && "border-border bg-secondary/40"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{label}</Badge>
                <span
                  className={cn(
                    "font-medium",
                    isCompleted && "text-green-400",
                    isMissed && "text-red-400"
                  )}
                >
                  {meal?.name}
                </span>
                {isMissed && (
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                    Missed
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                Eat between {timeWindow}
              </p>
              {macros && (
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    isCompleted && "text-green-400/90",
                    isMissed && "text-red-400/80",
                    !isCompleted && !isMissed && "text-primary"
                  )}
                >
                  {macros}
                </p>
              )}
              {meal?.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {meal.description}
                </p>
              )}
            </div>

            {isCompleted ? (
              <button
                type="button"
                disabled={isPending || !canToggle}
                onClick={() => handleAte(entry)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Undo ${label}`}
              >
                <Check className="h-3.5 w-3.5" />
                Ate
              </button>
            ) : (
              <Button
                size="sm"
                variant={isMissed ? "outline" : "default"}
                disabled={isPending || !canToggle}
                onClick={() => handleAte(entry)}
                className={cn(
                  "shrink-0",
                  isMissed && "border-red-500/50 text-red-400 hover:bg-red-500/10"
                )}
              >
                Ate
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Read-only list for dialogs */
export function ScheduledMealsList({ slots }: { slots: PlannedMealSlot[] }) {
  if (slots.length === 0) return null;

  return (
    <ul className="space-y-2">
      {slots.map(({ slot, label, meal, timeWindow, status }) => (
        <li
          key={slot}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5",
            status === "missed" && "border-red-500/40 bg-red-500/10",
            status === "completed" && "border-green-500/40 bg-green-500/10",
            status !== "missed" && status !== "completed" && "border-border bg-secondary/40"
          )}
        >
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{label}</Badge>
              <span
                className={cn(
                  "font-medium",
                  status === "completed" && "text-green-400",
                  status === "missed" && "text-red-400"
                )}
              >
                {meal?.name}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {timeWindow}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
