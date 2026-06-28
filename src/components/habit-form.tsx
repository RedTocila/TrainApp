"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveHabit, type SaveHabitInput } from "@/lib/actions/habits";
import {
  WEEKDAY_OPTIONS,
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import type { ClientHabit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HabitForm({
  clientId,
  habit,
  onSaved,
  onDelete,
}: {
  clientId: string;
  habit?: ClientHabit | null;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const platform = usePlatformCopy();
  const [title, setTitle] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [weeks, setWeeks] = useState(12);
  const [startMode, setStartMode] = useState<ScheduleStartMode>("now");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
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
      setWeekdays([0, 1, 2, 3, 4, 5, 6]);
      setWeeks(12);
      setStartMode("now");
    }
    setError(null);
  }, [habit]);

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
    if (timeStart && timeEnd && timeStart >= timeEnd) {
      setError("End time must be after start time");
      return;
    }
    if ((timeStart && !timeEnd) || (!timeStart && timeEnd)) {
      setError("Set both start and end times, or leave both empty for all day");
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
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          {habit ? "Edit habit" : "Add habit"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Set name, repeat schedule, and an optional time window. Leave times empty for all-day habits.
        </p>
      </div>

      <div className="space-y-5">
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
            <Label htmlFor="habit-time-start">From (optional)</Label>
            <Input
              id="habit-time-start"
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="habit-time-end">Until (optional)</Label>
            <Input
              id="habit-time-end"
              type="time"
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

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {habit && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-400"
            disabled={isPending}
            onClick={onDelete}
          >
            {platform.aria.removeHabit}
          </Button>
        ) : null}
        <Button
          className="w-full"
          disabled={isPending || !title.trim() || weekdays.length === 0}
          onClick={handleSave}
        >
          {isPending ? "Saving…" : habit ? "Save changes" : "Add habit"}
        </Button>
      </div>
    </div>
  );
}
