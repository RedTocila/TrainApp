"use client";
import { useCoachCopy, useCoachLabels, useLocale, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  clearNutritionSchedule,
  getNutritionScheduleForPlan,
  replaceNutritionSchedule,
  scheduleNutritionDays,
  scheduleNutritionSeries,
} from "@/lib/actions/user-nutrition-schedule";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { getWeekdayOptions } from "@/lib/locale-labels";
import {
  describeSchedulePreview,
  formatScheduleAnchorLabel,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { cn, formatDateKey } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NutritionScheduleFormProps {
  planId: string;
  planTitle: string;
  initialDates: string[];
  onSaved?: () => void;
}

function inferFromDates(dates: string[]): {
  weekdays: number[];
  weeks: number;
  startMode: ScheduleStartMode;
} | null {
  if (dates.length === 0) return null;
  const weekdays = [
    ...new Set(dates.map((d) => new Date(d + "T12:00:00").getDay())),
  ].sort((a, b) => a - b);
  const first = new Date(dates[0] + "T12:00:00");
  const last = new Date(dates[dates.length - 1] + "T12:00:00");
  const daysSpan = Math.max(
    1,
    Math.round((last.getTime() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  );
  const todayKey = formatDateKey(new Date());
  return {
    weekdays,
    weeks: daysSpan,
    startMode: dates[0] <= todayKey ? "now" : "next_week",
  };
}

export function NutritionScheduleForm({
  planId,
  planTitle,
  initialDates,
  onSaved,
}: NutritionScheduleFormProps) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const locale = useLocale();
  const weekdayOptions = getWeekdayOptions(locale);
  const inferred = useMemo(() => inferFromDates(initialDates), [initialDates]);
  const [weekdays, setWeekdays] = useState<number[]>(
    inferred?.weekdays ?? [new Date().getDay()]
  );
  const [weeks, setWeeks] = useState(inferred?.weeks ?? 4);
  const [startMode, setStartMode] = useState<ScheduleStartMode>(
    inferred?.startMode ?? "now"
  );
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    if (!inferred) return;
    setWeekdays(inferred.weekdays);
    setWeeks(inferred.weeks);
    setStartMode(inferred.startMode);
  }, [inferred]);

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

  const toggleExtraDate = (dateKey: string) => {
    setExtraDates((current) =>
      current.includes(dateKey)
        ? current.filter((d) => d !== dateKey)
        : [...current, dateKey]
    );
  };

  const handleSave = () => {
    if (weekdays.length === 0) return;
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const payload = {
        startDate: formatDateKey(anchor),
        weekdays,
        weeks,
        planId,
      };

      const result = inferred
        ? await replaceNutritionSchedule(payload)
        : await scheduleNutritionSeries(payload);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      if (extraDates.length > 0) {
        const extraResult = await scheduleNutritionDays(planId, extraDates);
        if (extraResult.error) {
          setMessage(extraResult.error);
          return;
        }
      }

      setSuccess(
        platform.nutrition.scheduleUpdated(
          weekdays.length * weeks + extraDates.length
        )
      );
      onSaved?.();
    });
  };

  const handleClear = () => {
    confirmGiveUp({
      ...coachCopy.clearNutritionSchedule,
      onConfirm: async () => {
        setMessage(null);
        setSuccess(null);
        const result = await clearNutritionSchedule(planId);
        if (result.error) setMessage(result.error);
        else {
          setSuccess(platform.nutrition.scheduleCleared);
          onSaved?.();
        }
      },
    });
  };

  const today = formatDateKey(new Date());
  const quickDates = useMemo(() => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return formatDateKey(d);
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{platform.nutrition.scheduleOnCalendar}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {platform.nutrition.scheduleDescription}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {initialDates.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {platform.nutrition.currentlyScheduled(initialDates.length)}
          </p>
        )}

        <div className="space-y-2">
          <Label>{platform.nutrition.start}</Label>
          <div className="flex flex-wrap gap-2">
            {(["now", "next_week"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStartMode(mode)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  startMode === mode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/60 hover:border-primary/40"
                )}
              >
                {formatScheduleAnchorLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{platform.nutrition.repeatOn}</Label>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleWeekday(value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  weekdays.includes(value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/60 hover:border-primary/40"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{platform.nutrition.weeks}</Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 4, 8].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWeeks(n)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  weeks === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/60 hover:border-primary/40"
                )}
              >
                {n} week{n === 1 ? "" : "s"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{preview}</p>
        </div>

        <div className="space-y-2">
          <Label>{platform.nutrition.alsoAddDates}</Label>
          <div className="flex flex-wrap gap-2">
            {quickDates.map((dateKey) => {
              const d = new Date(dateKey + "T12:00:00");
              const label =
                dateKey === today
                  ? platform.common.today
                  : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => toggleExtraDate(dateKey)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    extraDates.includes(dateKey)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary/60 hover:border-primary/40"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {message && <p className="text-sm text-red-400">{message}</p>}
        {success && <p className="text-sm text-primary">{success}</p>}

        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending || weekdays.length === 0} onClick={handleSave}>
            {platform.nutrition.saveSchedule}
          </Button>
          {initialDates.length > 0 && (
            <Button variant="outline" disabled={isPending} onClick={handleClear}>
              {coachLabels.giveUpOnSchedule}
            </Button>
          )}
        </div>
      </CardContent>
      {giveUpDialog}
    </Card>
  );
}
