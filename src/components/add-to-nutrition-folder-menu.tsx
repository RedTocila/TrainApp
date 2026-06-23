"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Apple, FolderPlus, Plus, Sparkles, X } from "lucide-react";
import type { NutritionPickItem } from "@/lib/actions/user-nutrition";
import { moveNutritionPlanToFolder } from "@/lib/actions/user-nutrition";
import { AddNutritionWizard } from "@/components/add-nutrition-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AddToNutritionFolderMenuProps {
  folderId: string;
  folderName: string;
  availablePlans: NutritionPickItem[];
}

export function AddToNutritionFolderMenu({
  folderId,
  folderName,
  availablePlans,
}: AddToNutritionFolderMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAddExisting = (planId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await moveNutritionPlanToFolder(planId, folderId);
      if (result.error) {
        setError(result.error);
      } else {
        setExistingOpen(false);
        setMenuOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setMenuOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add meal plan
      </Button>

      {menuOpen && (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Add to {folderName}
                </p>
                <h2 className="text-lg font-black">Add meal plan</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 p-4 sm:p-6">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setWizardOpen(true);
                }}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Create new meal plan</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Set macros and add meals
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setExistingOpen(true);
                }}
                disabled={availablePlans.length === 0}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <FolderPlus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Add existing meal plan</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {availablePlans.length === 0
                      ? "No other meal plans to add yet"
                      : `Move a plan from another folder (${availablePlans.length} available)`}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {existingOpen && (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Add to {folderName}
                </p>
                <h2 className="text-lg font-black">Existing meal plans</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setExistingOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-2">
                {availablePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAddExisting(plan.id)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Apple className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{plan.title}</p>
                      {plan.description && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        In {plan.currentFolderName}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>
          </div>
        </div>
      )}

      <AddNutritionWizard
        open={wizardOpen}
        folderId={folderId}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
