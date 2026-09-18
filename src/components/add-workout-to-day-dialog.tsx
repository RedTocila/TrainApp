"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, Check, Library, Plus, Sparkles, type LucideIcon } from "lucide-react";
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
  getScheduledDayEntriesForDate,
  unscheduleWorkoutDay,
  type PersonalWorkoutListItem,
} from "@/lib/actions/user-workouts";
import { inferDayCategory } from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";

type Mode = "library" | "create" | "ai";

function ModeSquare({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  accent: "primary" | "emerald" | "violet";
}) {
  const accents = {
    primary: {
      border: "border-primary/30 hover:border-primary/55",
      wash: "from-primary/18",
      glow: "bg-primary/25",
      well: "bg-primary/15 text-primary",
    },
    emerald: {
      border: "border-emerald-500/30 hover:border-emerald-400/55",
      wash: "from-emerald-500/18",
      glow: "bg-emerald-400/25",
      well: "bg-emerald-500/15 text-emerald-400",
    },
    violet: {
      border: "border-violet-500/30 hover:border-violet-400/55",
      wash: "from-violet-500/18",
      glow: "bg-violet-400/25",
      well: "bg-violet-500/15 text-violet-400",
    },
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex aspect-square flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm",
        "transition-[transform,border-color] duration-200 active:scale-[0.98]",
        accents.border
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br via-card to-card", accents.wash)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full blur-2xl",
          accents.glow
        )}
      />
      <span
        className={cn(
          "relative z-10 flex h-11 w-11 items-center justify-center rounded-full",
          accents.well
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="relative z-10 text-center text-[12px] font-bold leading-tight">
        {label}
      </span>
    </button>
  );
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
  const [mode, setMode] = useState<Mode | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<CreateWorkoutType | null>(null);
  const [workouts, setWorkouts] = useState<PersonalWorkoutListItem[]>([]);
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aiFooter, setAiFooter] = useState<ReactNode>(null);
  const initialScheduledRef = useRef<Set<string>>(new Set());
  const planIdByDayIdRef = useRef<Map<string, string>>(new Map());
  const libraryDirtyRef = useRef(false);
  const selectedDayIdsRef = useRef(selectedDayIds);
  selectedDayIdsRef.current = selectedDayIds;

  useEffect(() => {
    if (!open) {
      setMode(null);
      setWizardOpen(false);
      setWizardType(null);
      setError(null);
      setAiFooter(null);
      setSelectedDayIds(new Set());
      initialScheduledRef.current = new Set();
      planIdByDayIdRef.current = new Map();
      libraryDirtyRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "library") return;
    setLoading(true);
    void Promise.all([
      getPersonalWorkoutsWithSchedules(),
      getScheduledDayEntriesForDate(dateKey),
    ]).then(([loaded, scheduledEntries]) => {
      setWorkouts(loaded);
      const scheduled = new Set(scheduledEntries.map((entry) => entry.dayId));
      initialScheduledRef.current = scheduled;
      setSelectedDayIds(scheduled);
      libraryDirtyRef.current = false;

      const planIds = new Map<string, string>();
      for (const { plan, days } of loaded) {
        for (const day of days) {
          planIds.set(day.id, plan.id);
        }
      }
      planIdByDayIdRef.current = planIds;
      setLoading(false);
    });
  }, [open, mode, dateKey]);

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

  const applyLibrarySelection = () => {
    if (!libraryDirtyRef.current) return;
    libraryDirtyRef.current = false;

    const selected = selectedDayIdsRef.current;
    const initial = initialScheduledRef.current;
    const toAdd = [...selected].filter((dayId) => !initial.has(dayId));
    const toRemove = [...initial].filter((dayId) => !selected.has(dayId));
    if (toAdd.length === 0 && toRemove.length === 0) return;

    startTransition(async () => {
      await Promise.all([
        ...toRemove.map((dayId) => unscheduleWorkoutDay(dateKey, dayId)),
        ...toAdd.map((dayId) => {
          const planId = planIdByDayIdRef.current.get(dayId);
          return planId
            ? addWorkoutToDay(dateKey, planId, dayId)
            : Promise.resolve({ error: null });
        }),
      ]);
      onAdded?.();
    });
  };

  const handleClose = () => {
    onClose();
    applyLibrarySelection();
  };

  const handlePickFromLibrary = (dayId: string) => {
    setError(null);
    setSelectedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
    libraryDirtyRef.current = true;
  };

  const handleCreateType = (type: CreateWorkoutType) => {
    setWizardType(type);
    setWizardOpen(true);
  };

  const modeTitle =
    mode === "library"
      ? platform.workout.fromLibrary
      : mode === "create"
        ? platform.workout.createNew
        : mode === "ai"
          ? "AI"
          : null;

  return (
    <>
      <AppDialog
        open={open && !wizardOpen}
        onClose={handleClose}
        title={platform.workout.addWorkout}
        ariaLabel={platform.workout.addWorkoutToDayAria}
        maxWidth="max-w-md"
        footer={mode === "ai" ? aiFooter : undefined}
      >
        <div className="px-5 pb-5">
          {mode === null ? (
            <div className="grid grid-cols-3 gap-2.5">
              <ModeSquare
                icon={Library}
                label={platform.workout.fromLibrary}
                accent="primary"
                onClick={() => {
                  setError(null);
                  setMode("library");
                }}
              />
              <ModeSquare
                icon={Plus}
                label={platform.workout.createNew}
                accent="emerald"
                onClick={() => {
                  setError(null);
                  setMode("create");
                }}
              />
              <ModeSquare
                icon={Sparkles}
                label="AI"
                accent="violet"
                onClick={() => {
                  setError(null);
                  setMode("ai");
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {modeTitle}
              </button>

              {mode === "library" ? (
                loading ? (
                  <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
                ) : libraryEntries.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {platform.workout.libraryEmptyHint}
                    </p>
                    <Button size="sm" className="rounded-full" onClick={() => setMode("create")}>
                      {platform.workout.createNew}
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {libraryEntries.map((entry) => {
                      const isSelected = selectedDayIds.has(entry.dayId);
                      return (
                        <li key={`${entry.planId}-${entry.dayId}`}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handlePickFromLibrary(entry.dayId)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-colors",
                              isSelected
                                ? "border-emerald-500/45 bg-emerald-500/10"
                                : "border-border/60 bg-card/80 hover:border-primary/40 hover:bg-primary/10"
                            )}
                          >
                            <WorkoutCategoryIcon
                              category={entry.category}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {entry.dayTitle}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {entry.planTitle}
                                {entry.exerciseCount > 0
                                  ? ` · ${platform.common.exercises(entry.exerciseCount)}`
                                  : ""}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                <Check className="h-3 w-3" strokeWidth={2.5} />
                                {platform.workout.workoutAddedToDay}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : mode === "create" ? (
                <WorkoutTypeChooser value={null} onChange={handleCreateType} />
              ) : (
                <AddWorkoutToDayAiPanel
                  dateKey={dateKey}
                  onFooterChange={setAiFooter}
                  onAdded={() => {
                    onClose();
                    onAdded?.();
                  }}
                />
              )}
            </div>
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
          setWizardOpen(false);
          setWizardType(null);
          onClose();
          onAdded?.();
        }}
      />
    </>
  );
}
