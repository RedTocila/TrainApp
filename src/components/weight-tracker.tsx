"use client";

import { format, isToday } from "date-fns";
import { Scale } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { WeightChart } from "@/components/weight-chart";
import {
  deleteBodyWeightLog,
  getBodyWeightHistory,
  getBodyWeightLog,
  upsertBodyWeightLog,
} from "@/lib/actions/weight-logs";
import type { BodyWeightLog } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WeightTracker({
  clientId,
  initialHistory,
  initialLog,
}: {
  clientId: string;
  initialHistory: BodyWeightLog[];
  initialLog: BodyWeightLog | null;
}) {
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [history, setHistory] = useState(initialHistory);
  const [todayLog, setTodayLog] = useState(initialLog);
  const [weightInput, setWeightInput] = useState(
    initialLog ? String(initialLog.weight_kg) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTodayLog(null);
    setWeightInput("");
    startTransition(async () => {
      const [log, fetchedHistory] = await Promise.all([
        getBodyWeightLog(clientId, dateKey),
        getBodyWeightHistory(clientId),
      ]);
      setTodayLog(log);
      setWeightInput(log ? String(log.weight_kg) : "");
      setHistory(fetchedHistory);
    });
  }, [clientId, dateKey]);

  const dateLabel = isToday(selectedDate)
    ? "today"
    : format(selectedDate, "MMM d");

  const handleSave = () => {
    const parsed = parseFloat(weightInput);
    if (!Number.isFinite(parsed)) {
      setError("Enter a valid weight");
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
    });
  };

  const handleClear = () => {
    if (!todayLog) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBodyWeightLog(clientId, dateKey);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTodayLog(null);
      setWeightInput("");
      const fetchedHistory = await getBodyWeightHistory(clientId);
      setHistory(fetchedHistory);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Body weight
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Log your weight daily and track the trend over time
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <WeightChart entries={history} highlightDate={todayLog?.date} />

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="body-weight">
              Weight for {dateLabel} (kg)
            </Label>
            <Input
              id="body-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="500"
              placeholder="e.g. 75.5"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isPending || !weightInput}>
              {todayLog ? "Update" : "Log weight"}
            </Button>
            {todayLog && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
