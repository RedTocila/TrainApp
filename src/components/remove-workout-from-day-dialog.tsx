"use client";

import { useEffect, useState, useTransition } from "react";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { unscheduleWorkout } from "@/lib/actions/user-workouts";
import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import { cn } from "@/lib/utils";

export function RemoveWorkoutFromDayDialog({
  open,
  onClose,
  dateKey,
  workouts,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  workouts: TodaysWorkoutInfo[];
  onRemoved?: () => void;
}) {
  const platform = usePlatformCopy();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setError(null);
      return;
    }
    const first = workouts.find((workout) => workout.scheduledWorkoutId);
    if (first?.scheduledWorkoutId && workouts.filter((w) => w.scheduledWorkoutId).length === 1) {
      setSelectedId(first.scheduledWorkoutId);
    }
  }, [open, workouts]);

  const removable = workouts.filter((workout) => workout.scheduledWorkoutId);

  const handleRemove = () => {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const result = await unscheduleWorkout(dateKey, selectedId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onRemoved?.();
      onClose();
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Remove workout from this day"
      description="This only removes it from today's schedule — your program stays saved."
      ariaLabel="Remove workout from day"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 px-5 py-4">
        {removable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled to remove for this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {removable.map((workout) => {
              const id = workout.scheduledWorkoutId!;
              const selected = selectedId === id;
              return (
                <li key={workout.taskId}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-card/80 hover:border-border hover:bg-secondary/40"
                    )}
                  >
                    <span className="text-sm font-semibold">{workout.dayTitle}</span>
                    <span className="text-xs text-muted-foreground">{workout.planTitle}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {platform.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isPending || !selectedId}
          >
            {isPending ? platform.common.saving : "Remove"}
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
