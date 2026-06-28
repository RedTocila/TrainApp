"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday } from "date-fns";
import { ListChecks, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectedDate } from "@/components/date-provider";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import { dashboardDayCacheKey, getDashboardDayCache } from "@/lib/dashboard-day-cache";
import {
  applyHabitSuggestion,
  dismissHabitSuggestion,
} from "@/lib/actions/client-intake";
import {
  getHabitsWithCompletions,
  toggleHabitCompletion,
  type HabitWithStatus,
} from "@/lib/actions/habits";
import { getHabitDayStatus, canCompleteHabit } from "@/lib/habit-utils";
import { MissedButton } from "@/components/missed-items-dialog";
import { dashboard, DashboardEmptyState, DashboardSectionHeader } from "@/components/dashboard-ui";
import { DashboardStatusIcon } from "@/components/section-completed-badge";
import { useDashboardSync } from "@/components/dashboard-sync";
import type { ClientHabit } from "@/lib/types";
import type { HabitSuggestion } from "@/lib/habit-suggestions";
import { formatDateKey } from "@/lib/utils";
import { DASHBOARD_HABITS_NEW_PATH } from "@/lib/dashboard-day-routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HabitsTracker({
  clientId,
  initialHabits,
  suggestedHabits = [],
}: {
  clientId: string;
  initialHabits: HabitWithStatus[];
  suggestedHabits?: HabitSuggestion[];
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [habits, setHabits] = useState(initialHabits);
  const [suggestions, setSuggestions] = useState(suggestedHabits);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [suggestionsPending, setSuggestionsPending] = useState(false);
  const [tick, setTick] = useState(0);
  const { patchDashboard, notifySync } = useDashboardSync();
  const { todayKey } = useSelectedDate();

  useEffect(() => {
    setSuggestions(suggestedHabits);
  }, [suggestedHabits]);

  const seedHabits = dateKey === todayKey ? initialHabits : undefined;

  const { data: habitsForDay } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "habits",
    seed: seedHabits,
    fetcher: async () => getHabitsWithCompletions(clientId, dateKey),
  });

  useLayoutEffect(() => {
    const cached = getDashboardDayCache<HabitWithStatus[]>(
      dashboardDayCacheKey(clientId, "habits", dateKey)
    );
    if (cached) {
      setHabits(cached);
      return;
    }
    if (seedHabits) setHabits(seedHabits);
  }, [clientId, dateKey, seedHabits]);

  useEffect(() => {
    if (habitsForDay) setHabits(habitsForDay);
  }, [habitsForDay]);

  const displayHabitsRaw = habits;

  const reloadHabits = useCallback(() => {
    void getHabitsWithCompletions(clientId, dateKey).then(setHabits);
  }, [clientId, dateKey]);

  useEffect(() => {
    if (!isToday(selectedDate)) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const displayHabits = useMemo(
    () =>
      displayHabitsRaw.map((h) => ({
        ...h,
        status: getHabitDayStatus(h, dateKey, h.completed),
      })),
    [displayHabitsRaw, dateKey, tick]
  );

  const dateLabel = isToday(selectedDate)
    ? platform.common.today
    : format(selectedDate, "MMM d");
  const doneCount = displayHabits.filter((h) => h.completed).length;
  const missedHabits = displayHabits.filter((h) => h.status === "missed");
  const missedCount = missedHabits.length;
  const missedHabitItems = missedHabits.map((h) => ({
    id: h.id,
    label: h.title,
  }));

  const openAdd = () => {
    router.push(DASHBOARD_HABITS_NEW_PATH);
  };

  const openEdit = (habit: ClientHabit) => {
    router.push(`/dashboard/habits/${habit.id}/edit`);
  };

  const handleComplete = (habitId: string) => {
    setError(null);
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? { ...h, completed: true, status: "completed" as const }
          : h
      )
    );
    patchDashboard({
      dateKey,
      taskId: `habit-${habitId}`,
      completed: true,
    });

    setTogglingId(habitId);
    void toggleHabitCompletion(habitId, dateKey, new Date().getTimezoneOffset())
      .then((result) => {
        if (result.completed) {
          setError(null);
          notifySync();
          return;
        }
        if (result.error) {
          setError(result.error);
          setHabits((prev) =>
            prev.map((h) =>
              h.id === habitId
                ? { ...h, completed: false, status: getHabitDayStatus(h, dateKey, false) }
                : h
            )
          );
          patchDashboard({
            dateKey,
            taskId: `habit-${habitId}`,
            completed: false,
          });
        }
      })
      .finally(() => {
        setTogglingId((current) => (current === habitId ? null : current));
      });
  };

  const handleAddSuggestion = (suggestionId: string) => {
    setError(null);
    setSuggestionsPending(true);
    void applyHabitSuggestion(suggestionId)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        reloadHabits();
        notifySync();
      })
      .finally(() => setSuggestionsPending(false));
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setError(null);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    void dismissHabitSuggestion(suggestionId).then((result) => {
      if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <div id="dashboard-habits" className={cn(dashboard.tile, "p-4")}>
        <DashboardSectionHeader
          icon={ListChecks}
          iconClassName="text-violet-400"
          title={platform.habits.title}
          badge={
            <MissedButton
              count={missedCount}
              title={coachLabels.missedHabits}
              hint={coachLabels.habitsMissedHint}
              items={missedHabitItems}
            />
          }
          action={
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={openAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              {platform.common.add}
            </Button>
          }
          subtitle={
            displayHabitsRaw.length === 0
              ? coachLabels.addHabitsHint
              : platform.common.doneForDate(doneCount, displayHabitsRaw.length, dateLabel)
          }
        />
        <div className="mt-4 space-y-4">
          {suggestions.length > 0 && (
            <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
                <Sparkles className="h-4 w-4" />
                {platform.habits.suggestedFromProfile}
              </div>
              <ul className="space-y-2">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.reason}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={suggestionsPending}
                        onClick={() => handleAddSuggestion(suggestion.id)}
                      >
                        {platform.common.add}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={suggestionsPending}
                        onClick={() => handleDismissSuggestion(suggestion.id)}
                        aria-label={platform.aria.dismissSuggestion}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {displayHabitsRaw.length === 0 ? (
            <DashboardEmptyState>{coachLabels.noHabitsToday}</DashboardEmptyState>
          ) : displayHabitsRaw.length > 0 ? (
            <ul className="space-y-2">
              {displayHabits.map((habit) => {
                const canComplete = canCompleteHabit(habit, dateKey, habit.completed);

                return (
                  <li
                    key={habit.id}
                    id={`habit-${habit.id}`}
                    className={cn(dashboard.listRow, "items-center gap-3 py-2.5 px-3")}
                  >
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-sm font-medium leading-snug",
                        habit.completed && "text-muted-foreground line-through",
                        habit.status === "missed" && !habit.completed && "text-muted-foreground line-through"
                      )}
                    >
                      {habit.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {!habit.completed && habit.status !== "missed" && canComplete ? (
                        <Button
                          size="sm"
                          className="h-8 shrink-0 rounded-full px-3 text-xs"
                          disabled={togglingId === habit.id}
                          onClick={() => handleComplete(habit.id)}
                        >
                          {platform.habits.done}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => openEdit(habit)}
                        aria-label={platform.aria.editHabit}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      {habit.completed ? (
                        <DashboardStatusIcon status="completed" aria-label={platform.aria.completed} />
                      ) : habit.status === "missed" ? (
                        <DashboardStatusIcon status="missed" aria-label="Missed" />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </>
  );
}
