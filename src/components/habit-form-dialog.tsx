"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveHabit, type SaveHabitInput } from "@/lib/actions/habits";
import { formatHabitTimeWindow } from "@/lib/habit-utils";
import {
  WEEKDAY_OPTIONS,
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import type { ClientHabit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HabitFormDialogProps {
  open: boolean;
  clientId: string;
  habit?: ClientHabit | null;
  onClose: () => void;
  onSaved: () => void;
}

export function HabitFormDialog({
  open,
  clientId,
  habit,
  onClose,
  onSaved,
}: HabitFormDialogProps) {
  const [title, setTitle] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [weeks, setWeeks] = useState(12);
  const [startMode, setStartMode] = useState<ScheduleStartMode>("now");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (habit) {
      setTitle(habit.title);
      setTimeStart(habit.time_start?.slice(0, 5) ?? "");
      setTimeEnd(habit.time_end?.slice(0, 5) ?? "");
      setWeekdays(habit.weekdays?.length ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6]);
      setWeeks(habit.repeat_weeks ?? 12);
      setStartMode("now");
    } else {
      setTitle("");
      setTimeStart("");
      setTimeEnd("");
      setWeekdays([new Date().getDay()]);
      setWeeks(12);
      setStartMode("now");
    }
    setError(null);
  }, [open, habit]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

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
    if (!title.trim() || weekdays.length === 0) return;
    if (!timeStart || !timeEnd) {
      setError("Set both start and end times for the habit window");
      return;
    }
    if (timeStart >= timeEnd) {
      setError("End time must be after start time");
      return;
    }
    setError(null);

    const input: SaveHabitInput = {
      title,
      timeStart: timeStart || null,
      timeEnd: timeEnd || null,
      weekdays,
      weeks,
      startMode,
    };

    startTransition(async () => {
      const result = await saveHabit(clientId, input, habit?.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={habit ? "Edit habit" : "Add habit"}
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">
              {habit ? "Edit habit" : "Add habit"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Set name, time window, and repeat schedule. Complete habits only during the chosen hours.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="space-y-1">
            <Label htmlFor="habit-title">Habit name</Label>
            <Input
              id="habit-title"
              placeholder="e.g. Morning stretch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="habit-time-start">From *</Label>
              <Input
                id="habit-time-start"
                type="time"
                required
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="habit-time-end">Until *</Label>
              <Input
                id="habit-time-end"
                type="time"
                required
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </div>
          </div>

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
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    startMode === mode
                      ? "border-primary bg-primary/10"
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

          <div className="space-y-1">
            <Label htmlFor="habit-weeks">Repeat for how many weeks?</Label>
            <select
              id="habit-weeks"
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

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !title.trim() || weekdays.length === 0 || !timeStart || !timeEnd}
            onClick={handleSave}
          >
            {isPending ? "Saving…" : habit ? "Save changes" : "Add habit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function habitScheduleSummary(habit: ClientHabit): string {
  const days = (habit.weekdays ?? [])
    .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label)
    .filter(Boolean)
    .join(", ");
  const time = formatHabitTimeWindow(habit.time_start, habit.time_end);
  const parts = [days, time, `${habit.repeat_weeks ?? 12} wks`].filter(Boolean);
  return parts.join(" · ");
}
