"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createPersonalNutritionPlan } from "@/lib/actions/user-nutrition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddNutritionWizardProps {
  open: boolean;
  folderId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function AddNutritionWizard({
  open,
  folderId,
  onClose,
  onComplete,
}: AddNutritionWizardProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setError(null);
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

  const handleCreate = () => {
    if (!title.trim()) {
      setError("Day menu name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createPersonalNutritionPlan(title.trim(), undefined, {
        target_calories: 0,
        target_protein: 0,
        target_carbs: 0,
        target_fat: 0,
      }, folderId);
      if (result.error || !result.data) {
        setError(result.error ?? "Failed to create day menu");
        return;
      }
      onComplete();
      onClose();
      router.push(`/dashboard/nutrition/${result.data.id}/edit`);
    });
  };

  return (
    <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              New day menu
            </p>
            <h2 className="text-lg font-black">Create day menu</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Each day menu has 5 fixed slots: breakfast, 2 snacks, lunch, and dinner.
            Add meals to each slot and schedule it on your calendar.
          </p>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Weight loss day"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={isPending || !title.trim()}
              onClick={handleCreate}
            >
              Create & edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
