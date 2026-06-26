"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPersonalNutritionPlan } from "@/lib/actions/user-nutrition";
import { FullScreenFlow } from "@/components/programs/full-screen-flow";
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
  }, [open]);

  const handleClose = () => {
    setTitle("");
    setError(null);
    onClose();
  };

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
      setTitle("");
      onComplete();
      onClose();
      router.push(`/dashboard/nutrition/${result.data.id}/edit`);
    });
  };

  return (
    <FullScreenFlow
      open={open}
      onClose={handleClose}
      subtitle="New day menu"
      title="Create day menu"
      contentClassName="flex flex-col"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-8">
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
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
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
    </FullScreenFlow>
  );
}
