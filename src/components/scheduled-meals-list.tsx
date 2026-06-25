"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { Check, Clock } from "lucide-react";
import { useState, useTransition } from "react";
import {
  logPlannedMealOption,
  togglePlannedMealSlot,
} from "@/lib/actions/daily-meals";
import { MealOptionPickerDialog } from "@/components/meal-option-picker-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  canMarkMealSlotAsEaten,
  type PlannedMealSlot,
} from "@/lib/meal-times";
import { formatMealMacrosSummary, normalizeMealMacros } from "@/lib/meal-utils";
import type { Meal } from "@/lib/types";
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
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const [isPending, startTransition] = useTransition();
  const [pickerSlot, setPickerSlot] = useState<PlannedMealSlot | null>(null);
  const { notifySync } = useDashboardSync();

  if (slots.length === 0) return null;

  const handlePick = (meal: Meal) => {
    if (!pickerSlot) return;
    startTransition(async () => {
      const result = await logPlannedMealOption(
        clientId,
        dateKey,
        pickerSlot.slot,
        meal
      );
      if (result.error) return;
      setPickerSlot(null);
      onMealsChange();
      notifySync();
    });
  };

  const handleUndo = (entry: PlannedMealSlot) => {
    if (!entry.loggedMeal || !entry.meal) return;
    startTransition(async () => {
      const result = await togglePlannedMealSlot(
        clientId,
        dateKey,
        entry.slot,
        entry.meal!
      );
      if (result.error) return;
      onMealsChange();
      notifySync();
    });
  };

  const openPicker = (entry: PlannedMealSlot) => {
    if (entry.options.length === 1 && entry.options[0]) {
      startTransition(async () => {
        const result = await logPlannedMealOption(
          clientId,
          dateKey,
          entry.slot,
          entry.options[0]
        );
        if (result.error) return;
        onMealsChange();
        notifySync();
      });
      return;
    }
    setPickerSlot(entry);
  };

  return (
    <>
      <ul className="space-y-2">
        {slots.map((entry) => {
          const { slot, label, meal, options, timeWindow, status } = entry;
          const isCompleted = status === "completed";
          const isMissed = status === "missed";
          const canMark = canMarkMealSlotAsEaten(slot, dateKey, isCompleted);
          const macros = meal
            ? formatMealMacrosSummary(normalizeMealMacros(meal))
            : null;
          const optionCount = options.length;

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
                  {optionCount > 1 && !isCompleted && (
                    <span className="text-xs text-muted-foreground">
                      {platform.nutrition.options(optionCount)}
                    </span>
                  )}
                  {isCompleted && meal && (
                    <span className="font-medium text-green-400">{meal.name}</span>
                  )}
                  {isMissed && (
                    <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                      {coachLabels.missed}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {platform.nutrition.eatBetween(timeWindow)}
                </p>
                {isCompleted && macros && (
                  <p className="mt-1 text-xs font-medium text-green-400/90">{macros}</p>
                )}
              </div>

              {isCompleted ? (
                <button
                  type="button"
                  disabled={isPending || !canMark}
                  onClick={() => handleUndo(entry)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {platform.nutrition.ate}
                </button>
              ) : isMissed ? (
                <span className="shrink-0 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs font-medium text-red-400/80">
                  {platform.nutrition.windowClosed}
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={isPending || !canMark}
                  onClick={() => openPicker(entry)}
                  className="shrink-0"
                >
                  {optionCount > 1 ? platform.common.choose : platform.nutrition.ate}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <MealOptionPickerDialog
        open={!!pickerSlot}
        onClose={() => setPickerSlot(null)}
        slotLabel={pickerSlot?.label ?? ""}
        options={pickerSlot?.options ?? []}
        onSelect={handlePick}
        isPending={isPending}
      />
    </>
  );
}

/** Read-only list for dialogs */
export function ScheduledMealsList({ slots }: { slots: PlannedMealSlot[] }) {
  const platform = usePlatformCopy();
  if (slots.length === 0) return null;

  return (
    <ul className="space-y-2">
      {slots.map(({ slot, label, meal, options, timeWindow, status }) => (
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
              {meal && (
                <span
                  className={cn(
                    "font-medium",
                    status === "completed" && "text-green-400",
                    status === "missed" && "text-red-400"
                  )}
                >
                  {meal.name}
                </span>
              )}
              {options.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  {platform.nutrition.moreOptions(options.length - 1)}
                </span>
              )}
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
