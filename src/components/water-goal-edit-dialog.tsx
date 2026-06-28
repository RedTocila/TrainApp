"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppDialog } from "@/components/app-dialog";

export function WaterGoalEditDialog({
  open,
  onClose,
  waterGoalMl,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  waterGoalMl: number;
  onSave: (waterGoalMl: number) => Promise<{ error?: string } | void>;
}) {
  const [value, setValue] = useState(String(waterGoalMl));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setValue(String(Math.round(waterGoalMl)));
    setError(null);
  }, [open, waterGoalMl]);

  const handleSave = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 500 || parsed > 10000) {
      setError("Enter a goal between 500 and 10000 ml");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await onSave(Math.round(parsed));
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Edit water goal"
      description="Daily target for hydration tracking."
      ariaLabel="Edit water goal"
      maxWidth="max-w-sm"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="space-y-1">
          <Label htmlFor="water-goal-ml">Daily goal (ml)</Label>
          <Input
            id="water-goal-ml"
            type="number"
            min={500}
            max={10000}
            step={100}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </AppDialog>
  );
}
