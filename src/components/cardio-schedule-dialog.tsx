"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Calendar, X } from "lucide-react";
import { scheduleCardioSeries } from "@/lib/actions/user-cardio";
import type { ClientCardio } from "@/lib/types";
import {
  WEEKDAY_OPTIONS,
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CardioScheduleDialogProps {
  open: boolean;
  cardio: ClientCardio | null;
  onClose: () => void;
  onScheduled: () => void;
}

export function CardioScheduleDialog({
  open,
  cardio,
  onClose,
  onScheduled,
}: CardioScheduleDialogProps) {
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [weeks, setWeeks] = useState(4);
  const [startMode, setStartMode] = useState<ScheduleStartMode>("now");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setWeekdays([new Date().getDay()]);
    setWeeks(4);
    setStartMode("now");
    setError(null);
    setSuccess(null);
  }, [open, cardio?.id]);

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

  const handleSchedule = () => {
    if (!cardio) return;
    if (weekdays.length === 0) {
      setError("Select at least one day");
      return;
    }
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await scheduleCardioSeries({
        cardioId: cardio.id,
        weekdays,
        weeks,
        startMode,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(`Scheduled ${result.count} session${result.count === 1 ? "" : "s"}`);
      onScheduled();
    });
  };

  if (!open || !cardio) return null;

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
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Schedule cardio</h2>
            <p className="text-sm text-muted-foreground">{cardio.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
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
            <Label htmlFor="cardio-schedule-weeks">Repeat for how many weeks?</Label>
            <select
              id="cardio-schedule-weeks"
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
          {success && <p className="text-sm text-green-400">{success}</p>}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {success ? "Done" : "Cancel"}
          </Button>
          {!success && (
            <Button
              className="flex-1"
              disabled={isPending || weekdays.length === 0}
              onClick={handleSchedule}
            >
              <Calendar className="mr-1.5 h-4 w-4" />
              {isPending ? "Scheduling…" : "Schedule"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
