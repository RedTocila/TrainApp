"use client";

import { useEffect } from "react";
import type { Meal } from "@/lib/types";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import { AppDrawerHeader } from "@/components/app-dialog";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel
        maxWidth="max-w-md"
        aria-label={`Choose ${slotLabel}`}
        className="max-h-[min(92%,32rem)]"
      >
        <AppDrawerHeader
          title={slotLabel}
          description="Which option did you eat?"
        />
        <ul className="flex-1 space-y-2 overflow-y-auto px-5 pt-5 pb-4">
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
        <div className="px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </AppOverlayPanel>
      </AppOverlay>
  );
}
