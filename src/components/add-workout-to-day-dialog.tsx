"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { AddWorkoutToDayAiPanel } from "@/components/add-workout-to-day-ai-panel";
import { AddWorkoutToDayWizard } from "@/components/add-workout-to-day-wizard";
import { usePlatformCopy } from "@/components/locale-provider";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import {
  WorkoutTypeChooser,
  type CreateWorkoutType,
} from "@/components/workout-type-chooser";
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
  const [wizardType, setWizardType] = useState<CreateWorkoutType | null>(null);
  const [workouts, setWorkouts] = useState<PersonalWorkoutListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aiFooter, setAiFooter] = useState<ReactNode>(null);

  useEffect(() => {
    if (!open) {
      setMode("library");
      setWizardOpen(false);
      setWizardType(null);
      setError(null);
      setAiFooter(null);
      return;
    }
    setLoading(true);
    void getPersonalWorkoutsWithSchedules().then((loaded) => {
      setWorkouts(loaded);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (mode !== "ai") setAiFooter(null);
  }, [mode]);

  const libraryEntries = useMemo(
    () =>
      workouts.flatMap(({ plan, days }) =>
        days.map((day) => ({
          planId: plan.id,
          planTitle: plan.title,
          dayId: day.id,
          dayTitle: day.title,
          exerciseCount: day.exercises?.length ?? 0,
          category:
            plan.kind === "hiit" ||
            plan.kind === "warmup" ||
            plan.kind === "stretch"
              ? plan.kind === "hiit"
                ? ("hiit" as const)
                : inferDayCategory(day)
              : inferDayCategory(day),
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
      // Stay open so they can also add warmup / main / stretch.
    });
  };

  const handleCreateType = (type: CreateWorkoutType) => {
    setWizardType(type);
    setWizardOpen(true);
  };

  const dayLabel = formatDayLabel(dateKey);

  return (
    <>
      <AppDialog
        open={open && !wizardOpen}
        onClose={onClose}
        title={platform.workout.addWorkout}
        description={platform.workout.addWorkoutToDayDesc(dayLabel)}
        ariaLabel={platform.workout.addWorkoutToDayAria}
        maxWidth="max-w-md"
        footer={mode === "ai" ? aiFooter : undefined}
      >
        <div className="sticky top-0 z-20 flex flex-wrap gap-2 border-b border-border/50 bg-card px-5 pb-3 pt-1">
          <Button
            size="sm"
            variant={mode === "library" ? "default" : "outline"}
            onClick={() => setMode("library")}
          >
            {platform.workout.fromLibrary}
          </Button>
          <Button
            size="sm"
            variant={mode === "create" ? "default" : "outline"}
            onClick={() => setMode("create")}
          >
            {platform.workout.createNew}
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

        <div className="px-5 py-4">
          {mode === "library" ? (
            loading ? (
              <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
            ) : libraryEntries.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {platform.workout.libraryEmptyHint}
                </p>
                <Button size="sm" onClick={() => setMode("create")}>
                  {platform.workout.createNew}
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose fitness (sets &amp; reps) or HIIT (intervals) for {dayLabel}.
              </p>
              <WorkoutTypeChooser value={null} onChange={handleCreateType} />
            </div>
          ) : (
            <AddWorkoutToDayAiPanel
              dateKey={dateKey}
              dayLabel={dayLabel}
              onFooterChange={setAiFooter}
              onAdded={() => {
                onAdded?.();
                onClose();
              }}
            />
          )}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>
      </AppDialog>

      <AddWorkoutToDayWizard
        open={wizardOpen}
        dateKey={dateKey}
        initialType={wizardType}
        onClose={() => {
          setWizardOpen(false);
          setWizardType(null);
        }}
        onComplete={() => {
          onAdded?.();
          setWizardOpen(false);
          setWizardType(null);
          // Stay on add dialog so another session (warmup/stretch) can be added.
        }}
      />
    </>
  );
}
