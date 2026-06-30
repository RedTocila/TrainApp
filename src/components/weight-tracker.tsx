"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy, useBodyUnits } from "@/components/locale-provider";

import { format, isToday } from "date-fns";
import { Plus } from "lucide-react";
import { ElectronicScale } from "@/components/icons/electronic-scale";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import { WeightChartLazy } from "@/components/weight-chart-lazy";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import {
  deleteBodyWeightLog,
  getBodyWeightHistory,
  getBodyWeightLog,
  upsertBodyWeightLog,
} from "@/lib/actions/weight-logs";
import type { BodyWeightLog } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboard, DashboardSectionHeader } from "@/components/dashboard-ui";
import { cn } from "@/lib/utils";

export function WeightTracker({
  clientId,
  intakeWeightKg,
  startDate,
  initialHistory,
  initialLog,
  onHistoryChange,
}: {
  clientId: string;
  intakeWeightKg?: number | null;
  startDate?: string | null;
  initialHistory: BodyWeightLog[];
  initialLog: BodyWeightLog | null;
  onHistoryChange?: (history: BodyWeightLog[]) => void;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const dateKey = formatDateKey(selectedDate);
  const [history, setHistory] = useState(initialHistory);
  const [weightInput, setWeightInput] = useState(
    initialLog ? units.formatWeightKg(initialLog.weight_kg) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    let cancelled = false;
    void getBodyWeightHistory(clientId).then((fetchedHistory) => {
      if (cancelled) return;
      setHistory(fetchedHistory);
      onHistoryChange?.(fetchedHistory);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, onHistoryChange]);

  const seedLog = dateKey === todayKey ? initialLog : undefined;

  const { data: todayLog } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "weight-log",
    seed: seedLog,
    fetcher: async () => getBodyWeightLog(clientId, dateKey),
  });

  const todayLogForDay = todayLog ?? seedLog ?? null;

  useEffect(() => {
    setWeightInput(
      todayLogForDay ? units.formatWeightKg(todayLogForDay.weight_kg) : ""
    );
  }, [todayLogForDay?.id, todayLogForDay?.weight_kg, dateKey, units]);

  const dateLabel = isToday(selectedDate)
    ? platform.common.today
    : format(selectedDate, "MMM d");

  const refreshHistory = useCallback(async () => {
    const fetchedHistory = await getBodyWeightHistory(clientId);
    setHistory(fetchedHistory);
    onHistoryChange?.(fetchedHistory);
  }, [clientId, onHistoryChange]);

  const handleSave = () => {
    const parsed = units.parseWeightInput(weightInput);
    if (parsed == null) {
      setError(platform.weight.invalidWeight);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await upsertBodyWeightLog(clientId, dateKey, parsed);
      if (result.error) {
        setError(result.error);
        return;
      }
      const log = await getBodyWeightLog(clientId, dateKey);
      setWeightInput(log ? units.formatWeightKg(log.weight_kg) : "");
      await refreshHistory();
      setFormOpen(false);
    });
  };

  const handleClear = () => {
    if (!todayLogForDay) return;
    confirmGiveUp({
      ...coachCopy.clearWeight,
      onConfirm: async () => {
        setError(null);
        const result = await deleteBodyWeightLog(clientId, dateKey);
        if (result.error) {
          setError(result.error);
          return;
        }
        setWeightInput("");
        setFormOpen(false);
        await refreshHistory();
      },
    });
  };

  const openForm = () => {
    setError(null);
    setFormOpen(true);
  };

  return (
    <div className={cn(dashboard.tile, "p-4")}>
      <DashboardSectionHeader
        icon={ElectronicScale}
        iconClassName="text-primary"
        title={platform.weight.title}
        subtitle={
          todayLogForDay
            ? platform.weight.loggedForDate(
                units.formatWeightKgWithUnit(todayLogForDay.weight_kg),
                dateLabel
              )
            : platform.weight.subtitle
        }
        action={
          !readOnly && !formOpen ? (
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={openForm}
            >
              <Plus className="h-3.5 w-3.5" />
              {platform.weight.logWeight}
            </Button>
          ) : undefined
        }
      />
      <div className="mt-4 space-y-6">
        <WeightChartLazy
          entries={history}
          highlightDate={todayLogForDay?.date}
          startWeightKg={intakeWeightKg}
          startDate={startDate}
        />

        {formOpen && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="body-weight">
                {platform.weight.weightForDate(dateLabel, units.weightUnit)}
              </Label>
              <Input
                id="body-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max={units.maxWeightInput}
                placeholder={units.weightPlaceholder}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending || !weightInput}>
                {todayLogForDay ? platform.common.update : platform.weight.logWeight}
              </Button>
              {todayLogForDay && (
                <Button variant="outline" disabled={isPending} onClick={handleClear}>
                  {coachLabels.clearWeight}
                </Button>
              )}
              <Button variant="ghost" disabled={isPending} onClick={() => setFormOpen(false)}>
                {platform.common.cancel}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      {giveUpDialog}
    </div>
  );
}
