"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Footprints, Pencil } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { dashboard } from "@/components/dashboard-ui";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import { dashboardInteractive } from "@/components/dashboard-card-nav-link";
import { AppDialog } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getHealthSteps } from "@/lib/health-steps";
import { updateStepGoal } from "@/lib/actions/logs";
import { formatDateKey } from "@/lib/utils";

const subscribe = () => () => {};
/** Sample count so the card can be seen on localhost. Real steps only exist in the iOS app. */
const LOCAL_PREVIEW_STEPS = 8420;
const DEFAULT_STEP_GOAL = 10000;
const STEP_GOAL_KEY = "rutina-step-goal";
const MIN_STEP_GOAL = 1000;
const MAX_STEP_GOAL = 100000;

function isIosApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function clampStepGoal(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < MIN_STEP_GOAL || rounded > MAX_STEP_GOAL) return null;
  return rounded;
}

function readStoredStepGoal(): number | null {
  try {
    return clampStepGoal(Number(localStorage.getItem(STEP_GOAL_KEY)));
  } catch {
    return null;
  }
}

export function DashboardStepsCard({
  initialGoal,
}: {
  initialGoal?: number | null;
}) {
  const iosApp = useSyncExternalStore(subscribe, isIosApp, () => false);
  const previewAtStart = process.env.NODE_ENV === "development";
  const [localPreview, setLocalPreview] = useState(previewAtStart);
  const platform = usePlatformCopy();
  const locale = useLocale();
  const { selectedDate, todayKey } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const title =
    dateKey === todayKey
      ? platform.dashboard.todaysSteps
      : platform.dashboard.stepsOnDay(format(selectedDate, "MMM d"));
  const [steps, setSteps] = useState<number | null>(
    previewAtStart ? LOCAL_PREVIEW_STEPS : null
  );
  const [note, setNote] = useState<string | null>(previewAtStart ? "Preview" : null);
  const [goal, setGoal] = useState(
    () => clampStepGoal(initialGoal) ?? DEFAULT_STEP_GOAL
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const fromProfile = clampStepGoal(initialGoal);
    if (fromProfile != null) {
      setGoal(fromProfile);
      return;
    }
    const stored = readStoredStepGoal();
    if (stored != null) setGoal(stored);
  }, [initialGoal]);

  useEffect(() => {
    const preview = process.env.NODE_ENV === "development" && !isIosApp();
    setLocalPreview(preview);
    if (preview) {
      setSteps(LOCAL_PREVIEW_STEPS);
      setNote("Preview");
      return;
    }
    if (!iosApp) return;
    let cancelled = false;

    const load = async () => {
      try {
        const result = await getHealthSteps(dateKey);
        if (cancelled) return;
        if (!result.available) {
          setSteps(null);
          setNote(platform.dashboard.stepsUnavailable);
          return;
        }
        if (result.permitted === false) {
          setSteps(null);
          setNote(platform.dashboard.stepsNeedsPermission);
          return;
        }
        setSteps(result.steps);
        setNote(null);
      } catch {
        if (cancelled) return;
        setSteps(null);
        setNote(platform.dashboard.stepsNeedsPermission);
      }
    };

    let listener: Promise<{ remove: () => Promise<void> }> | null = null;
    const start = () => {
      if (cancelled) return;
      void load();
      listener = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void load();
      });
    };
    const cancelIdle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(start, { timeout: 1500 })
        : window.setTimeout(start, 300);

    return () => {
      cancelled = true;
      if (typeof cancelIdle === "number" && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(cancelIdle);
      } else {
        window.clearTimeout(cancelIdle);
      }
      void listener?.then((handle) => handle.remove());
    };
  }, [
    dateKey,
    iosApp,
    platform.dashboard.stepsNeedsPermission,
    platform.dashboard.stepsUnavailable,
  ]);

  if (!iosApp && !localPreview) return null;

  const count =
    steps === null
      ? "—"
      : new Intl.NumberFormat(locale === "en" ? "en" : "sq").format(steps);

  const goalPercent =
    steps == null ? 0 : Math.min(100, Math.round((steps / goal) * 100));
  const formattedGoal = new Intl.NumberFormat(locale === "en" ? "en" : "sq").format(goal);

  return (
    <DashboardThemedShell
      id="dashboard-steps"
      theme="steps"
      solid
      className={cn(dashboard.pairTile, "relative isolate")}
    >
      <div className="flex h-8 shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Footprints className="h-4 w-4 text-lime-300" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-white/80">
          {title}
        </p>
        <button
          type="button"
          className={cn(
            dashboardInteractive,
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/75"
          )}
          aria-label={platform.dashboard.editStepGoal}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between py-2">
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <p className="text-5xl font-black tabular-nums leading-none tracking-tight">
            {count}
          </p>
          <p className="text-[10px] font-medium text-white/70">
            {note ?? platform.dashboard.stepsFromHealth}
            {" · "}
            {platform.dashboard.stepGoalOf(formattedGoal)}
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-lime-400"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
      </div>
      <StepGoalDialog
        open={editing}
        goal={goal}
        onClose={() => setEditing(false)}
        onSaved={(next) => {
          setGoal(next);
          try {
            localStorage.setItem(STEP_GOAL_KEY, String(next));
          } catch {
            /* private mode */
          }
        }}
      />
    </DashboardThemedShell>
  );
}

function StepGoalDialog({
  open,
  goal,
  onClose,
  onSaved,
}: {
  open: boolean;
  goal: number;
  onClose: () => void;
  onSaved: (goal: number) => void;
}) {
  const platform = usePlatformCopy();
  const [value, setValue] = useState(String(goal));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setValue(String(goal));
    setError(null);
  }, [open, goal]);

  const handleSave = () => {
    const parsed = clampStepGoal(Number(value));
    if (parsed == null) {
      setError(platform.dashboard.stepGoalInvalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateStepGoal(parsed);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved(parsed);
      onClose();
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={platform.dashboard.editStepGoal}
      description={platform.dashboard.stepGoalHint}
      ariaLabel={platform.dashboard.editStepGoal}
      maxWidth="max-w-sm"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {platform.common.cancel}
          </Button>
          <Button type="button" className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? platform.common.saving : platform.common.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="space-y-1">
          <Label htmlFor="step-goal">{platform.dashboard.stepGoalLabel}</Label>
          <Input
            id="step-goal"
            type="number"
            min={MIN_STEP_GOAL}
            max={MAX_STEP_GOAL}
            step={500}
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
