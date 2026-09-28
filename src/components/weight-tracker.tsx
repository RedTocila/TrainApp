"use client";
import { useCoachCopy, useCoachLabels, useLocale, usePlatformCopy, useBodyUnits } from "@/components/locale-provider";

import { isToday } from "date-fns";
import { formatLocalized } from "@/lib/date-locale";
import { Plus } from "lucide-react";
import { ElectronicScale } from "@/components/icons/electronic-scale";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { formatDateKey, cn } from "@/lib/utils";
import { dashboardDayCacheKey, setDashboardDayCache } from "@/lib/dashboard-day-cache";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSectionHeader } from "@/components/dashboard-ui";
import { DashboardThemedShell, DASHBOARD_CARD_BACKGROUNDS } from "@/components/dashboard-themed-shell";
import { DashboardStatusIcon, dashboardCompletionStatus } from "@/components/section-completed-badge";
import { isDayEnded } from "@/lib/meal-times";

function withLog(history: BodyWeightLog[], log: BodyWeightLog): BodyWeightLog[] {
  return [...history.filter((entry) => entry.date !== log.date), log].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

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
  const locale = useLocale();
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
  const saveSeqRef = useRef(0);
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    let cancelled = false;
    void getBodyWeightHistory(clientId).then((fetchedHistory) => {
      if (cancelled || saveSeqRef.current > 0) return;
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

  const [localLog, setLocalLog] = useState<{
    dateKey: string;
    log: BodyWeightLog | null;
  } | null>(null);

  const todayLogForDay =
    localLog?.dateKey === dateKey ? localLog.log : (todayLog ?? seedLog ?? null);

  useEffect(() => {
    setWeightInput(
      todayLogForDay ? units.formatWeightKg(todayLogForDay.weight_kg) : ""
    );
  }, [todayLogForDay?.id, todayLogForDay?.weight_kg, dateKey, units]);

  const dateLabel = isToday(selectedDate)
    ? platform.common.today
    : formatLocalized(selectedDate, "MMM d", locale);

  /** Show a log (or its removal) for a date immediately, without a refetch. */
  const applyLocalLog = useCallback(
    (forDate: string, log: BodyWeightLog | null, nextHistory: BodyWeightLog[]) => {
      setLocalLog({ dateKey: forDate, log });
      setDashboardDayCache(dashboardDayCacheKey(clientId, "weight-log", forDate), log);
      setHistory(nextHistory);
      onHistoryChange?.(nextHistory);
    },
    [clientId, onHistoryChange]
  );

  const handleSave = () => {
    const parsed = units.parseWeightInput(weightInput);
    if (parsed == null) {
      setError(platform.weight.invalidWeight);
      return;
    }
    setError(null);

    const forDate = dateKey;
    const previousLog = todayLogForDay;
    const previousHistory = history;
    const optimistic: BodyWeightLog = {
      id: previousLog?.id ?? `pending-${forDate}`,
      client_id: clientId,
      date: forDate,
      weight_kg: parsed,
      created_at: previousLog?.created_at ?? new Date().toISOString(),
    };
    applyLocalLog(forDate, optimistic, withLog(previousHistory, optimistic));
    setFormOpen(false);

    const seq = ++saveSeqRef.current;
    startTransition(async () => {
      const result = await upsertBodyWeightLog(clientId, forDate, parsed).catch(() => ({
        error: platform.profile.saveFailed,
      }));
      if (seq !== saveSeqRef.current) return;
      if ("error" in result && result.error) {
        applyLocalLog(forDate, previousLog, previousHistory);
        setError(result.error);
        setFormOpen(true);
        return;
      }
      if ("log" in result && result.log) {
        applyLocalLog(forDate, result.log, withLog(previousHistory, result.log));
      }
    });
  };

  const handleClear = () => {
    if (!todayLogForDay) return;
    confirmGiveUp({
      ...coachCopy.clearWeight,
      onConfirm: async () => {
        setError(null);
        const forDate = dateKey;
        const previousLog = todayLogForDay;
        const previousHistory = history;
        applyLocalLog(
          forDate,
          null,
          previousHistory.filter((entry) => entry.date !== forDate)
        );
        setWeightInput("");
        setFormOpen(false);

        const seq = ++saveSeqRef.current;
        const result = await deleteBodyWeightLog(clientId, forDate);
        if (seq !== saveSeqRef.current) return;
        if (result.error) {
          applyLocalLog(forDate, previousLog, previousHistory);
          setError(result.error);
        }
      },
    });
  };

  const openForm = () => {
    setError(null);
    setFormOpen(true);
  };

  return (
    <DashboardThemedShell
      theme="weight"
      backgroundSrc={DASHBOARD_CARD_BACKGROUNDS.weight}
      backgroundAlt={platform.weight.title}
      className="p-4"
    >
      <DashboardSectionHeader
        icon={ElectronicScale}
        iconClassName="text-teal-300"
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
          <div className="flex items-center gap-2">
            {!readOnly && !formOpen ? (
              <Button
                size="sm"
                className="!h-8 rounded-full px-3 text-xs"
                onClick={openForm}
              >
                <Plus className="h-3.5 w-3.5" />
                {platform.weight.logWeight}
              </Button>
            ) : null}
            <DashboardStatusIcon
              status={dashboardCompletionStatus(
                !!todayLogForDay,
                isDayEnded(dateKey)
              )}
              aria-label={
                todayLogForDay
                  ? platform.aria.completed
                  : platform.common.incomplete
              }
            />
          </div>
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
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
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
    </DashboardThemedShell>
  );
}
