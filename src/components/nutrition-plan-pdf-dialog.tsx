"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { NutritionPlanPdfViewer } from "@/components/nutrition-plan-pdf-viewer";
import { Button } from "@/components/ui/button";

export function NutritionPlanPdfDialog({
  open,
  onClose,
  title,
  requestId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  requestId: string;
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
        aria-labelledby="nutrition-pdf-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="nutrition-pdf-title" className="text-base font-bold">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <NutritionPlanPdfViewer requestId={requestId} />
        </div>
      </div>
    </div>
  );
}
