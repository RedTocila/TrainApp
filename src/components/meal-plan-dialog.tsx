"use client";

import { useEffect } from "react";
import { FileText, X } from "lucide-react";
import { MealPlanViewer } from "@/components/meal-plan-viewer";
import type { PlannedMealSlot } from "@/lib/meal-times";
import { Button } from "@/components/ui/button";

export function MealPlanDialog({
  open,
  onClose,
  title,
  subtitle,
  slots,
  emptyMessage,
  coachPdfRequestId,
  onOpenCoachPdf,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  slots: PlannedMealSlot[];
  emptyMessage?: string;
  coachPdfRequestId?: string | null;
  onOpenCoachPdf?: () => void;
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
        aria-labelledby="meal-plan-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="meal-plan-title" className="text-base font-bold">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <MealPlanViewer slots={slots} emptyMessage={emptyMessage} />
        </div>
        {coachPdfRequestId && onOpenCoachPdf && (
          <div className="border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={onOpenCoachPdf}
            >
              <FileText className="h-4 w-4" />
              View coach PDF plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
