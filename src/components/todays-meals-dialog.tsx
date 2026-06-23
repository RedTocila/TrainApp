"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Meal } from "@/lib/types";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import { MEAL_SLOTS } from "@/lib/meal-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TodaysMealsDialogProps {
  open: boolean;
  planTitle?: string;
  meals: Meal[];
  onClose: () => void;
}

export function TodaysMealsDialog({
  open,
  planTitle,
  meals,
  onClose,
}: TodaysMealsDialogProps) {
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

  if (!open) return null;

  const sorted = [...meals].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What to eat today"
        className="relative z-10 flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">What to eat today</h2>
            {planTitle && (
              <p className="text-sm text-muted-foreground">{planTitle}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No meals in your plan yet
            </p>
          ) : (
            <ul className="space-y-4">
              {sorted.map((meal) => {
                const slotMeta = MEAL_SLOTS.find(
                  (s) => s.slot === meal.slot || s.meal_type === meal.meal_type
                );
                return (
                <li
                  key={meal.id}
                  className="rounded-lg border border-border bg-secondary/40 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="capitalize">
                      {slotMeta?.label ?? meal.meal_type}
                    </Badge>
                    <span className="font-semibold">{meal.name}</span>
                  </div>
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
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
