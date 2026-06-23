"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Meal } from "@/lib/types";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MealOptionPickerDialog({
  open,
  onClose,
  slotLabel,
  options,
  onSelect,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  slotLabel: string;
  options: Meal[];
  onSelect: (meal: Meal) => void;
  isPending?: boolean;
}) {
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
        aria-label={`Choose ${slotLabel}`}
        className="relative z-10 flex max-h-[min(90vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{slotLabel}</h2>
            <p className="text-sm text-muted-foreground">Which option did you eat?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {options.map((meal, idx) => {
            const macros = formatMealMacrosSummary(normalizeMealMacros(meal));
            return (
              <li key={meal.id ?? idx}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onSelect(meal)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                  )}
                >
                  <p className="font-semibold">{meal.name}</p>
                  {macros && (
                    <p className="mt-1 text-sm text-primary">{macros}</p>
                  )}
                  {meal.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {meal.description}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
