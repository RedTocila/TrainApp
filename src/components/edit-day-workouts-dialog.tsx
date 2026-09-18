"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { AddWorkoutToDayDialog } from "@/components/add-workout-to-day-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { unscheduleWorkout } from "@/lib/actions/user-workouts";
import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import { cn } from "@/lib/utils";

export function EditDayWorkoutsDialog({
  open,
  onClose,
  dateKey,
  workouts,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  workouts: TodaysWorkoutInfo[];
  onChanged?: () => void;
}) {
  const platform = usePlatformCopy();
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removable = workouts.filter((workout) => workout.scheduledWorkoutId);

  const handleRemove = (scheduledWorkoutId: string) => {
    setError(null);
    setRemovingId(scheduledWorkoutId);
    startTransition(async () => {
      const result = await unscheduleWorkout(dateKey, scheduledWorkoutId);
      setRemovingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged?.();
    });
  };

  const handleClose = () => {
    if (addOpen) return;
    setError(null);
    onClose();
  };

  return (
    <>
      <AppDialog
        open={open && !addOpen}
        onClose={handleClose}
        title={platform.workout.editDayWorkouts}
        ariaLabel={platform.workout.editDayWorkoutsAria}
        maxWidth="max-w-md"
      >
        <div className="space-y-3 px-5 pb-4">
          {removable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {platform.workout.noWorkoutsOnDay}
            </p>
          ) : (
            <ul className="space-y-2">
              {removable.map((workout) => {
                const id = workout.scheduledWorkoutId!;
                const busy = isPending && removingId === id;
                return (
                  <li key={workout.taskId}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5",
                        busy && "opacity-60"
                      )}
                    >
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {workout.dayTitle}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="!h-9 !w-9 shrink-0 rounded-full text-red-500 hover:bg-red-500/15 hover:text-red-400"
                        disabled={isPending}
                        aria-label={platform.workout.removeWorkoutFromDayAria}
                        onClick={() => handleRemove(id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full rounded-full font-semibold"
            onClick={() => {
              setError(null);
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {platform.workout.addWorkout}
          </Button>
        </div>
      </AppDialog>

      <AddWorkoutToDayDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        dateKey={dateKey}
        intent="add"
        onAdded={() => {
          setAddOpen(false);
          onChanged?.();
        }}
      />
    </>
  );
}
