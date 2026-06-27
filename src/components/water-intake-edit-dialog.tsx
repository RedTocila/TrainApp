"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaterIntakeEditDialog({
  open,
  onClose,
  currentMl,
  waterGoalMl,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentMl: number;
  waterGoalMl: number;
  onSave: (waterMl: number) => Promise<{ error?: string } | void>;
}) {
  const [value, setValue] = useState(String(currentMl));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setValue(String(Math.round(currentMl)));
    setError(null);
  }, [open, currentMl]);

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

  const handleSave = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 15000) {
      setError("Enter a value between 0 and 15000 ml");
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
        aria-label="Edit water intake"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Edit water intake</h2>
            <p className="text-sm text-muted-foreground">
              Goal: {waterGoalMl.toLocaleString()} ml
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1">
            <Label htmlFor="water-intake-ml">Amount (ml)</Label>
            <Input
              id="water-intake-ml"
              type="number"
              min={0}
              max={15000}
              step={50}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
