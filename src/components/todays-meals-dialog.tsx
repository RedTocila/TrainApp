"use client";

import { useEffect, useMemo } from "react";
import { Clock, X } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import type { DailyMealLog, Meal } from "@/lib/types";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import {
  getPlannedMealSlots,
  mealSlotStatusLabel,
  type PlannedMealSlot,
} from "@/lib/meal-times";
import { ScheduledMealsList } from "@/components/scheduled-meals-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TodaysMealsDialogProps {
  open: boolean;
  planTitle?: string;
  meals: Meal[];
  dailyMeals?: DailyMealLog[];
  dateKey?: string;
  onClose: () => void;
}

export function TodaysMealsDialog({
  open,
  planTitle,
  meals,
  dailyMeals = [],
  dateKey,
  onClose,
}: TodaysMealsDialogProps) {
  const platform = usePlatformCopy();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const slotByMealId = useMemo(() => {
    if (!dateKey) return new Map<string, PlannedMealSlot>();
    const slots = getPlannedMealSlots(meals, dailyMeals, dateKey);
    const map = new Map<string, PlannedMealSlot>();
    for (const slot of slots) {
      if (slot.meal) map.set(slot.meal.id, slot);
    }
    return map;
  }, [meals, dailyMeals, dateKey]);

  if (!open) return null;

  const sorted = [...meals].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={platform.mealLog.whatToEatToday}
        className="relative z-10 flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{platform.mealLog.whatToEatToday}</h2>
            {planTitle && (
              <p className="text-sm text-muted-foreground">{planTitle}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={platform.aria.close}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {dateKey && meals.length > 0 && (
            <div className="mb-5">
              <ScheduledMealsList
                slots={getPlannedMealSlots(meals, dailyMeals, dateKey)}
              />
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No meals in your plan yet
            </p>
          ) : (
            <ul className="space-y-4">
              {sorted.map((meal) => {
                const slotInfo = slotByMealId.get(meal.id);
                const statusLabel = slotInfo
                  ? mealSlotStatusLabel(slotInfo.status)
                  : undefined;

                return (
                  <li
                    key={meal.id}
                    className={cn(
                      "rounded-lg border border-border bg-secondary/40 p-4",
                      slotInfo?.status === "missed" && "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="capitalize">
                        {slotInfo?.label ?? meal.meal_type}
                      </Badge>
                      <span className="font-semibold">{meal.name}</span>
                      {statusLabel && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            slotInfo?.status === "missed" && "bg-red-500/15 text-red-400",
                            slotInfo?.status === "completed" && "bg-primary/15 text-primary"
                          )}
                        >
                          {statusLabel}
                        </Badge>
                      )}
                    </div>
                    {slotInfo && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Eat between {slotInfo.timeWindow}
                      </p>
                    )}
                    {meal.description && (
                      <p className="mb-2 text-sm text-muted-foreground">{meal.description}</p>
                    )}
                    {(() => {
                      const summary = formatMealMacrosSummary(normalizeMealMacros(meal));
                      return summary ? (
                        <p className="mb-2 text-xs font-medium text-primary">{summary}</p>
                      ) : null;
                    })()}
                    <ul className="space-y-1.5">
                      {meal.foods?.map((ingredient, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span>{ingredient.name}</span>
                          {ingredient.amount && (
                            <span className="shrink-0 text-muted-foreground">
                              {ingredient.amount}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {platform.common.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
