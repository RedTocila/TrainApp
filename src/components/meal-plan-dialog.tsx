"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { MealPlanViewer } from "@/components/meal-plan-viewer";
import { GroceryListDialog } from "@/components/grocery-list-dialog";
import type { PlannedMealSlot } from "@/lib/meal-times";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function MealPlanDialog({
  open,
  onClose,
  title,
  subtitle,
  slots,
  emptyMessage,
  clientId,
  planId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  slots: PlannedMealSlot[];
  emptyMessage?: string;
  clientId?: string;
  planId?: string | null;
}) {
  const platform = usePlatformCopy();
  const [groceryOpen, setGroceryOpen] = useState(false);
  const showGrocery = Boolean(clientId && planId);

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

  useEffect(() => {
    if (!open) setGroceryOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label={platform.common.close}
          className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="meal-plan-title"
          className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id="meal-plan-title" className="text-base font-bold">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {showGrocery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setGroceryOpen(true)}
                  aria-label={platform.groceryList.title}
                >
                  <ShoppingCart className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label={platform.common.close}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto px-4 py-5">
            <MealPlanViewer slots={slots} emptyMessage={emptyMessage} />
          </div>
        </div>
      </div>

      {showGrocery && clientId && planId ? (
        <GroceryListDialog
          open={groceryOpen}
          clientId={clientId}
          planId={planId}
          onClose={() => setGroceryOpen(false)}
        />
      ) : null}
    </>
  );
}
