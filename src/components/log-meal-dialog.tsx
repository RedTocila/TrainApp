"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { logCustomMeal, logMealFromLibrary } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import {
  emptyMealForm,
  formatMealMacrosSummary,
  normalizeMealMacros,
  type MealFormData,
} from "@/lib/meal-utils";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogMode = "library" | "custom";

export function LogMealDialog({
  open,
  clientId,
  dateKey,
  library,
  onClose,
  onLogged,
}: {
  open: boolean;
  clientId: string;
  dateKey: string;
  library: PersonalMealLibraryItem[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [mode, setMode] = useState<LogMode>("library");
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setMode(library.length > 0 ? "library" : "custom");
    setForm(emptyMealForm());
    setError(null);
  }, [open, library.length]);

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

  const handleLogCustom = () => {
    if (!form.name.trim()) {
      setError("Meal name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logCustomMeal(clientId, dateKey, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      onLogged();
      onClose();
    });
  };

  const handleLogFromLibrary = (mealId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await logMealFromLibrary(clientId, dateKey, mealId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onLogged();
      onClose();
    });
  };

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
        aria-label="Log a meal"
        className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-black">Log a meal</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-2 border-b border-border px-5 py-3">
          {(
            [
              ["library", "From library"],
              ["custom", "New meal"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "library" ? (
            library.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No saved meals yet. Switch to New meal to log one with macros.
              </p>
            ) : (
              <ul className="space-y-2">
                {library.map((item) => {
                  const summary = formatMealMacrosSummary(normalizeMealMacros(item.meal));
                  return (
                    <li
                      key={item.meal.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge className="capitalize">{item.meal.meal_type}</Badge>
                          <span className="font-semibold">{item.meal.name}</span>
                        </div>
                        {summary && (
                          <p className="text-xs text-muted-foreground">{summary}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.folderName} · {item.planTitle}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={isPending}
                        onClick={() => handleLogFromLibrary(item.meal.id)}
                      >
                        Add
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <MealDetailsFields
              mealType={form.meal_type}
              onMealTypeChange={(meal_type) => setForm((prev) => ({ ...prev, meal_type }))}
              name={form.name}
              onNameChange={(name) => setForm((prev) => ({ ...prev, name }))}
              description={form.description}
              onDescriptionChange={(description) =>
                setForm((prev) => ({ ...prev, description }))
              }
              macros={form.macros}
              onMacrosChange={(macros) => setForm((prev) => ({ ...prev, macros }))}
              ingredients={form.ingredients}
              onIngredientsChange={(ingredients) =>
                setForm((prev) => ({ ...prev, ingredients }))
              }
              autoFocusName
            />
          )}
        </div>

        <div className="space-y-2 border-t border-border px-5 py-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {mode === "custom" ? (
            <Button className="w-full" disabled={isPending} onClick={handleLogCustom}>
              Log meal
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
