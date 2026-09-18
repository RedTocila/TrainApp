"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, Check, Library, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { AppOverlay } from "@/components/app-overlay";
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
  const iconColor = {
    primary: "text-primary",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-3 transition-transform duration-200 active:scale-95"
    >
      <Icon className={cn("h-12 w-12", iconColor)} strokeWidth={1.75} />
      <span className="text-center text-sm font-bold leading-tight text-foreground">
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
  intent = "add",
}: {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  onAdded?: () => void;
  /** "edit" uses edit-day copy; library mode still adds and removes. */
  intent?: "add" | "edit";
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

  const dialogTitle =
    intent === "edit" ? platform.workout.editDayWorkouts : platform.workout.addWorkout;
  const dialogAria =
    intent === "edit"
      ? platform.workout.editDayWorkoutsAria
      : platform.workout.addWorkoutToDayAria;

  useEffect(() => {
    selectedDayIdsRef.current = selectedDayIds;
  }, [selectedDayIds]);

  useEffect(() => {
    if (open) return;
    const frame = window.requestAnimationFrame(() => {
      setMode(null);
      setWizardOpen(false);
      setWizardType(null);
      setError(null);
      setAiFooter(null);
      setSelectedDayIds(new Set());
      initialScheduledRef.current = new Set();
      planIdByDayIdRef.current = new Map();
      libraryDirtyRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "library") return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setLoading(true);
    });
    void Promise.all([
      getPersonalWorkoutsWithSchedules(),
      getScheduledDayEntriesForDate(dateKey),
    ]).then(([loaded, scheduledEntries]) => {
      if (cancelled) return;
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
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [open, mode, dateKey]);

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
    if (toAdd.length === 0) return;

    startTransition(async () => {
      await Promise.all(
        toAdd.map((dayId) => {
          const planId = planIdByDayIdRef.current.get(dayId);
          return planId
            ? addWorkoutToDay(dateKey, planId, dayId)
            : Promise.resolve({ error: null });
        })
      );
      onAdded?.();
    });
  };

  const handleClose = () => {
    onClose();
    applyLibrarySelection();
  };

  const handlePickFromLibrary = (dayId: string) => {
    if (initialScheduledRef.current.has(dayId)) return;
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
      {mode === null ? (
        <AppOverlay
          open={open && !wizardOpen}
          onClose={handleClose}
          presentation="center"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogAria}
            className="relative z-10 w-full max-w-sm"
          >
            <div className="grid grid-cols-3 gap-4">
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
          </div>
        </AppOverlay>
      ) : (
        <AppDialog
          open={open && !wizardOpen}
          onClose={handleClose}
          title={dialogTitle}
          ariaLabel={dialogAria}
          maxWidth="max-w-md"
          footer={mode === "ai" ? aiFooter : undefined}
        >
          <div className="space-y-3 px-5 pb-4">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAiFooter(null);
                  setMode(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
                      const alreadyOnDay = initialScheduledRef.current.has(
                        entry.dayId
                      );
                      const isSelected =
                        !alreadyOnDay && selectedDayIds.has(entry.dayId);
                      return (
                        <li key={`${entry.planId}-${entry.dayId}`}>
                          <button
                            type="button"
                            disabled={alreadyOnDay}
                            aria-pressed={isSelected}
                            aria-disabled={alreadyOnDay}
                            onClick={() => handlePickFromLibrary(entry.dayId)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-colors",
                              alreadyOnDay
                                ? "cursor-not-allowed border-border/40 bg-secondary/30 opacity-55"
                                : isSelected
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
                            {alreadyOnDay ? (
                              <span className="inline-flex shrink-0 items-center rounded-full bg-secondary/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                {platform.workout.alreadyOnDay}
                              </span>
                            ) : isSelected ? (
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
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          </div>
        </AppDialog>
      )}

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
