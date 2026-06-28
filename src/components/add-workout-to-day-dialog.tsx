"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Dumbbell, PenLine, Sparkles } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { AddWorkoutToDayAiPanel } from "@/components/add-workout-to-day-ai-panel";
import { AddWorkoutToDayWizard } from "@/components/add-workout-to-day-wizard";
import { usePlatformCopy } from "@/components/locale-provider";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { Button } from "@/components/ui/button";
import {
  addWorkoutToDay,
  getPersonalWorkoutsWithSchedules,
  type PersonalWorkoutListItem,
} from "@/lib/actions/user-workouts";
import { inferDayCategory } from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";

type Mode = "library" | "create" | "ai";

function formatDayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function AddWorkoutToDayDialog({
  open,
  onClose,
  dateKey,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  onAdded?: () => void;
}) {
  const platform = usePlatformCopy();
  const [mode, setMode] = useState<Mode>("library");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [workouts, setWorkouts] = useState<PersonalWorkoutListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("library");
      setError(null);
      return;
    }
    setLoading(true);
    void getPersonalWorkoutsWithSchedules().then((loaded) => {
      setWorkouts(loaded);
      setLoading(false);
    });
  }, [open]);

  const libraryEntries = useMemo(
    () =>
      workouts.flatMap(({ plan, days }) =>
        days.map((day) => ({
          planId: plan.id,
          planTitle: plan.title,
          dayId: day.id,
          dayTitle: day.title,
          exerciseCount: day.exercises?.length ?? 0,
          category: inferDayCategory(day),
        }))
      ),
    [workouts]
  );

  const handlePickFromLibrary = (planId: string, dayId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await addWorkoutToDay(dateKey, planId, dayId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onAdded?.();
      onClose();
    });
  };

  const dayLabel = formatDayLabel(dateKey);

  return (
    <>
      <AppDialog
        open={open && !wizardOpen}
        onClose={onClose}
        title="Add workout"
        description={`Add a session for ${dayLabel} only — it won't change your recurring schedule.`}
        ariaLabel="Add workout to day"
        maxWidth="max-w-md"
      >
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-2">
          <Button
            size="sm"
            variant={mode === "library" ? "default" : "outline"}
            onClick={() => setMode("library")}
          >
            From library
          </Button>
          <Button
            size="sm"
            variant={mode === "create" ? "default" : "outline"}
            onClick={() => setMode("create")}
          >
            Create new
          </Button>
          <Button
            size="sm"
            variant={mode === "ai" ? "default" : "outline"}
            onClick={() => setMode("ai")}
            className="gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </Button>
        </div>

        <div className="max-h-[min(50vh,20rem)] overflow-y-auto px-5 py-4">
          {mode === "library" ? (
            loading ? (
              <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
            ) : libraryEntries.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No workouts in your library yet — create one for this day instead.
                </p>
                <Button size="sm" onClick={() => setMode("create")}>
                  Create new
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {libraryEntries.map((entry) => (
                  <li key={`${entry.planId}-${entry.dayId}`}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handlePickFromLibrary(entry.planId, entry.dayId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 text-left transition-colors",
                        "hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      )}
                    >
                      <WorkoutCategoryIcon category={entry.category} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{entry.dayTitle}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.planTitle}
                          {entry.exerciseCount > 0
                            ? ` · ${platform.common.exercises(entry.exerciseCount)}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : mode === "create" ? (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <PenLine className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Build from scratch</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Create a one-off workout and add it to {dayLabel}.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Dumbbell className="h-4 w-4" />
                    Build workout
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <AddWorkoutToDayAiPanel
              dateKey={dateKey}
              dayLabel={dayLabel}
              onAdded={() => {
                onAdded?.();
                onClose();
              }}
            />
          )}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {platform.common.cancel}
          </Button>
        </div>
      </AppDialog>

      <AddWorkoutToDayWizard
        open={wizardOpen}
        dateKey={dateKey}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          onAdded?.();
          setWizardOpen(false);
          onClose();
        }}
      />
    </>
  );
}
