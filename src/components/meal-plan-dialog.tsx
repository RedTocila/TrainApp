"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { MealPlanViewer } from "@/components/meal-plan-viewer";
import type { PlannedMealSlot } from "@/lib/meal-times";
import { Button } from "@/components/ui/button";

export function MealPlanDialog({
  open,
  onClose,
  title,
  slots,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  slots: PlannedMealSlot[];
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-plan-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="meal-plan-title" className="text-base font-bold">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <MealPlanViewer slots={slots} />
        </div>
      </div>
    </div>
  );
}
