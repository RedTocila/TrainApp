"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { format, isToday } from "date-fns";
import { Check, ListChecks, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { HabitFormDialog } from "@/components/habit-form-dialog";
import {
  applyHabitSuggestion,
  dismissHabitSuggestion,
} from "@/lib/actions/client-intake";
import {
  deleteHabit,
  getHabitsWithCompletions,
  toggleHabitCompletion,
  type HabitWithStatus,
} from "@/lib/actions/habits";
import { getHabitDayStatus, canCompleteHabit } from "@/lib/habit-utils";
import { MissedButton } from "@/components/missed-items-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import type { ClientHabit } from "@/lib/types";
import type { HabitSuggestion } from "@/lib/habit-suggestions";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [habits, setHabits] = useState(initialHabits);
  const [suggestions, setSuggestions] = useState(suggestedHabits);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<ClientHabit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [suggestionsPending, setSuggestionsPending] = useState(false);
  const [tick, setTick] = useState(0);
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();
  const { patchDashboard, notifySync } = useDashboardSync();

  useEffect(() => {
    setSuggestions(suggestedHabits);
  }, [suggestedHabits]);

  const refresh = useCallback(async () => {
    setHabits([]);
    const data = await getHabitsWithCompletions(clientId, dateKey);
    setHabits(data);
  }, [clientId, dateKey]);

  useDashboardDateFetch(`${dateKey}:${todayKey}`, refresh);

  useEffect(() => {
    if (!isToday(selectedDate)) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const displayHabits = useMemo(
    () =>
      habits.map((h) => ({
        ...h,
        status: getHabitDayStatus(h, dateKey, h.completed),
      })),
    [habits, dateKey, tick]
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
    setEditingHabit(null);
    setDialogOpen(true);
  };

  const openEdit = (habit: ClientHabit) => {
    setEditingHabit(habit);
    setDialogOpen(true);
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
    void toggleHabitCompletion(habitId, dateKey)
      .then((result) => {
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

  const handleDelete = (habitId: string) => {
    confirmGiveUp({
      ...coachCopy.removeHabit,
      onConfirm: async () => {
        const result = await deleteHabit(habitId);
        if (result.error) {
          setError(result.error);
          return;
        }
        refresh();
      },
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
        refresh();
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
      <Card id="dashboard-habits">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <ListChecks className="h-5 w-5 text-violet-400" />
              {platform.habits.title}
              <MissedButton
                count={missedCount}
                title={coachLabels.missedHabits}
                hint={coachLabels.habitsMissedHint}
                items={missedHabitItems}
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {habits.length === 0
                ? coachLabels.addHabitsHint
                : platform.common.doneForDate(doneCount, habits.length, dateLabel)}
            </p>
          </div>
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={openAdd}
            aria-label={platform.aria.addHabit}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {habits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {coachLabels.noHabitsToday}
            </div>
          ) : (
            <ul className="space-y-2">
              {displayHabits.map((habit) => {
                const canComplete = canCompleteHabit(habit, dateKey, habit.completed);

                return (
                  <li
                    key={habit.id}
                    id={`habit-${habit.id}`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-3 py-2.5",
                      habit.completed && "border-green-500/30 bg-green-500/5",
                      habit.status === "missed" &&
                        !habit.completed &&
                        "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-sm font-medium",
                        habit.completed && "text-green-400 line-through",
                        habit.status === "missed" && !habit.completed && "text-red-400"
                      )}
                    >
                      {habit.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {habit.completed ? (
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
                          aria-label={platform.aria.completed}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      ) : canComplete ? (
                        <Button
                          size="sm"
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleDelete(habit.id)}
                        aria-label={platform.aria.removeHabit}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      <HabitFormDialog
        open={dialogOpen}
        clientId={clientId}
        habit={editingHabit}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          refresh();
          notifySync();
        }}
      />
      {giveUpDialog}
    </>
  );
}
