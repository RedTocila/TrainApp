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
  onRemoved?: (scheduledWorkoutIds: string[]) => void;
}) {
  const platform = usePlatformCopy();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setError(null);
      return;
    }
    const removableIds = workouts
      .map((workout) => workout.scheduledWorkoutId)
      .filter((id): id is string => Boolean(id));
    if (removableIds.length === 1) {
      setSelectedIds(removableIds);
    } else {
      setSelectedIds([]);
    }
  }, [open, workouts]);

  const removable = workouts.filter((workout) => workout.scheduledWorkoutId);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id]
    );
  };

  const handleRemove = () => {
    if (selectedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await unscheduleWorkout(dateKey, selectedIds);
      if (result.error) {
        setError(result.error);
        return;
      }
      onRemoved?.(selectedIds);
      onClose();
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={platform.workout.removeWorkoutFromDay}
      description={platform.workout.removeWorkoutFromDayDesc}
      ariaLabel={platform.workout.removeWorkoutFromDayAria}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 px-5 py-4">
        {removable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {platform.workout.nothingScheduledToRemove}
          </p>
        ) : (
          <ul className="space-y-2">
            {removable.map((workout) => {
              const id = workout.scheduledWorkoutId!;
              const selected = selectedIds.includes(id);
              return (
                <li key={workout.taskId}>
                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={selected}
                    onClick={() => toggleSelected(id)}
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
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isPending || selectedIds.length === 0}
          >
            {isPending ? platform.common.saving : "Remove"}
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
