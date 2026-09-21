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
  refreshing = false,
  onChanged,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  workouts: TodaysWorkoutInfo[];
  refreshing?: boolean;
  onChanged?: () => void;
  /** Optimistic remove — called immediately with scheduled workout ids. */
  onRemoved?: (scheduledWorkoutIds: string[]) => void;
}) {
  const platform = usePlatformCopy();
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removable = workouts.filter((workout) => workout.scheduledWorkoutId);
  const busy = refreshing;

  const handleRemove = (scheduledWorkoutId: string) => {
    setError(null);
    setRemovingId(scheduledWorkoutId);
    // Instant UI update — don't wait for the server round-trip.
    onRemoved?.([scheduledWorkoutId]);
    startTransition(async () => {
      const result = await unscheduleWorkout(dateKey, scheduledWorkoutId);
      setRemovingId(null);
      if (result.error) {
        setError(result.error);
        // Roll back by reloading the day.
        onChanged?.();
        return;
      }
    });
  };

  const handleClose = () => {
    if (addOpen || busy) return;
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
          {refreshing ? (
            <div
              className="space-y-2"
              role="status"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="h-12 w-full animate-pulse rounded-xl bg-secondary/80" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-secondary/80" />
              <div className="h-12 w-3/4 animate-pulse rounded-xl bg-secondary/70" />
              <p className="pt-1 text-center text-xs text-muted-foreground">
                {platform.common.loading}
              </p>
            </div>
          ) : removable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {platform.workout.noWorkoutsOnDay}
            </p>
          ) : (
            <ul className="space-y-2">
              {removable.map((workout) => {
                const id = workout.scheduledWorkoutId!;
                const rowBusy = isPending && removingId === id;
                return (
                  <li key={workout.taskId}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5",
                        rowBusy && "opacity-60"
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
                        disabled={busy}
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
            disabled={busy}
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
