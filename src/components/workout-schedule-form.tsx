"use client";
import { useCoachCopy, useCoachLabels } from "@/components/locale-provider";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  clearPlanSchedule,
  replacePlanSchedule,
  scheduleWorkoutSeries,
} from "@/lib/actions/user-workouts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import {
  WEEKDAY_OPTIONS,
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type InferredSchedule,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { formatDateKey } from "@/lib/utils";
import type { WorkoutDay } from "@/lib/types";

interface WorkoutScheduleFormProps {
  planId: string;
  days: WorkoutDay[];
  initialSchedule: InferredSchedule | null;
  onSaved?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  saveLabel?: string;
}

export function WorkoutScheduleForm({
  planId,
  days,
  initialSchedule,
  onSaved,
  showBackButton,
  onBack,
  saveLabel = "Save schedule",
}: WorkoutScheduleFormProps) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const [dayId, setDayId] = useState(
    initialSchedule?.dayId ?? days[0]?.id ?? ""
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    initialSchedule?.weekdays ?? [1, 3, 5]
  );
  const [weeks, setWeeks] = useState(initialSchedule?.weeks ?? 4);
  const [startMode, setStartMode] = useState<ScheduleStartMode>(
    initialSchedule?.startMode ?? "now"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    if (!days.some((d) => d.id === dayId)) {
      setDayId(days[0]?.id ?? "");
    }
  }, [days, dayId]);

  useEffect(() => {
    if (initialSchedule) return;
    if (startMode === "now") {
      setWeekdays([new Date().getDay()]);
    } else {
      setWeekdays([1, 3, 5]);
    }
  }, [startMode, initialSchedule]);

  const anchor = useMemo(() => getScheduleAnchorDate(startMode), [startMode]);
  const preview = useMemo(
    () => describeSchedulePreview(anchor, weekdays, weeks),
    [anchor, weekdays, weeks]
  );

  const toggleWeekday = (value: number) => {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b)
    );
  };

  const handleSave = () => {
    if (!dayId || weekdays.length === 0) return;
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const payload = {
        startDate: formatDateKey(anchor),
        weekdays,
        weeks,
        planId,
        dayId,
      };

      const result = initialSchedule
        ? await replacePlanSchedule(payload)
        : await scheduleWorkoutSeries(payload);

      if (result.error) {
        setMessage(result.error);
      } else if (result.success) {
        setSuccess(
          initialSchedule
            ? "Schedule updated."
            : `Scheduled ${"count" in result ? result.count : 0} session${"count" in result && result.count === 1 ? "" : "s"}.`
        );
        onSaved?.();
      }
    });
  };

  const handleClear = () => {
    confirmGiveUp({
      ...coachCopy.clearWorkoutSchedule,
      onConfirm: async () => {
        setMessage(null);
        setSuccess(null);
        const result = await clearPlanSchedule(planId);
        if (result.error) {
          setMessage(result.error);
        } else {
          setSuccess("Upcoming sessions removed.");
          onSaved?.();
        }
      },
    });
  };

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Save at least one workout day before scheduling.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {initialSchedule && (
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
          {initialSchedule.upcomingCount} upcoming session
          {initialSchedule.upcomingCount === 1 ? "" : "s"} scheduled. Changes
          replace future sessions only.
        </p>
      )}

      <div className="space-y-2">
        <Label>When to start</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { mode: "now" as const, label: "Start right now" },
              { mode: "next_week" as const, label: "Next week (Monday)" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setStartMode(mode)}
              className={cn(
                "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                startMode === mode
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground"
              )}
            >
              <p className="font-semibold">{label}</p>
              <p className="mt-0.5 text-xs opacity-80">
                {formatScheduleAnchorLabel(mode)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Workout day</Label>
        <select
          value={dayId}
          onChange={(e) => setDayId(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          {days.map((day) => (
            <option key={day.id} value={day.id}>
              {day.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Repeat on these days</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleWeekday(value)}
              className={cn(
                "min-w-[2.75rem] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                weekdays.includes(value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-weeks">Repeat for how many weeks?</Label>
        <select
          id="schedule-weeks"
          value={weeks}
          onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} week{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>

      <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
        {preview}
      </p>

      {message && <p className="text-sm text-red-400">{message}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <div className="flex flex-wrap gap-2">
        {showBackButton && onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        {initialSchedule && (
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isPending}
            className="text-red-400 hover:text-red-300"
          >
            {coachLabels.giveUpOnSchedule}
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isPending || !dayId || weekdays.length === 0}
        >
          {saveLabel}
        </Button>
      </div>
      {giveUpDialog}
    </div>
  );
}
