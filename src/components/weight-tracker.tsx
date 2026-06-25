"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday } from "date-fns";
import { Plus, Scale } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { WeightChartLazy } from "@/components/weight-chart-lazy";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [history, setHistory] = useState(initialHistory);
  const [todayLog, setTodayLog] = useState(initialLog);
  const [weightInput, setWeightInput] = useState(
    initialLog ? String(initialLog.weight_kg) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    setTodayLog(null);
    setWeightInput("");
    setFormOpen(false);
    startTransition(async () => {
      const [log, fetchedHistory] = await Promise.all([
        getBodyWeightLog(clientId, dateKey),
        getBodyWeightHistory(clientId),
      ]);
      setTodayLog(log);
      setWeightInput(log ? String(log.weight_kg) : "");
      setHistory(fetchedHistory);
      onHistoryChange?.(fetchedHistory);
    });
  }, [clientId, dateKey, onHistoryChange]);

  const dateLabel = isToday(selectedDate)
    ? platform.common.today
    : format(selectedDate, "MMM d");

  const handleSave = () => {
    const parsed = parseFloat(weightInput);
    if (!Number.isFinite(parsed)) {
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
      const [log, fetchedHistory] = await Promise.all([
        getBodyWeightLog(clientId, dateKey),
        getBodyWeightHistory(clientId),
      ]);
      setTodayLog(log);
      setHistory(fetchedHistory);
      onHistoryChange?.(fetchedHistory);
      setFormOpen(false);
    });
  };

  const handleClear = () => {
    if (!todayLog) return;
    confirmGiveUp({
      ...coachCopy.clearWeight,
      onConfirm: async () => {
        setError(null);
        const result = await deleteBodyWeightLog(clientId, dateKey);
        if (result.error) {
          setError(result.error);
          return;
        }
        setTodayLog(null);
        setWeightInput("");
        setFormOpen(false);
        const fetchedHistory = await getBodyWeightHistory(clientId);
        setHistory(fetchedHistory);
        onHistoryChange?.(fetchedHistory);
      },
    });
  };

  const openForm = () => {
    setError(null);
    setFormOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {platform.weight.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {todayLog
              ? platform.weight.loggedForDate(String(todayLog.weight_kg), dateLabel)
              : platform.weight.subtitle}
          </p>
        </div>
        {!formOpen && (
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={openForm}
            aria-label={platform.aria.logWeight}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <WeightChartLazy
          entries={history}
          highlightDate={todayLog?.date}
          startWeightKg={intakeWeightKg}
          startDate={startDate}
        />

        {formOpen && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="body-weight">{platform.weight.weightForDate(dateLabel)}</Label>
              <Input
                id="body-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max="500"
                placeholder={platform.weight.placeholder}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending || !weightInput}>
                {todayLog ? platform.common.update : platform.weight.logWeight}
              </Button>
              {todayLog && (
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
      </CardContent>
      {giveUpDialog}
    </Card>
  );
}
