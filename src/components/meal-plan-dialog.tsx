"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setGroceryOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-lg" aria-labelledby="meal-plan-title" className="max-h-[92%]">
          <div className="flex shrink-0 items-start justify-between gap-2 px-5 pb-3.5 pt-1 sm:pt-4">
            <div className="min-w-0 flex-1">
              <h2 id="meal-plan-title" className="text-lg font-black leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {showGrocery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setGroceryOpen(true)}
                aria-label={platform.groceryList.title}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <div className="overflow-y-auto px-5 pt-5 pb-5">
            <MealPlanViewer slots={slots} emptyMessage={emptyMessage} />
          </div>
        </AppOverlayPanel>
    </AppOverlay>

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
