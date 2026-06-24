"use client";

import { format, isToday } from "date-fns";
import { Check, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { HabitFormDialog } from "@/components/habit-form-dialog";
import {
  deleteHabit,
  getHabitsWithCompletions,
  toggleHabitCompletion,
  type HabitWithStatus,
} from "@/lib/actions/habits";
import { getHabitDayStatus, canCompleteHabit } from "@/lib/habit-utils";
import { MissedButton } from "@/components/missed-items-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import type { ClientHabit } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HabitsTracker({
  clientId,
  initialHabits,
}: {
  clientId: string;
  initialHabits: HabitWithStatus[];
}) {
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [habits, setHabits] = useState(initialHabits);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<ClientHabit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);
  const { patchDashboard, notifySync } = useDashboardSync();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const fetched = await getHabitsWithCompletions(clientId, dateKey);
      setHabits(fetched);
    });
  }, [clientId, dateKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    ? "today"
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
    notifySync();

    startTransition(async () => {
      const result = await toggleHabitCompletion(habitId, dateKey);
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
        return;
      }
    });
  };

  const handleDelete = (habitId: string) => {
    if (!confirm("Remove this habit and its schedule?")) return;
    startTransition(async () => {
      const result = await deleteHabit(habitId);
      if (result.error) {
        setError(result.error);
        return;
      }
      refresh();
    });
  };

  return (
    <>
      <Card id="dashboard-habits">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <ListChecks className="h-5 w-5 text-violet-400" />
              Daily habits
              <MissedButton
                count={missedCount}
                title="Missed habits"
                hint="Stick to your schedule tomorrow."
                items={missedHabitItems}
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {habits.length === 0
                ? "Add habits to track each day"
                : `${doneCount}/${habits.length} done for ${dateLabel}`}
            </p>
          </div>
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={openAdd}
            aria-label="Add habit"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {habits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No habits scheduled for this day
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
                          aria-label="Completed"
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      ) : canComplete ? (
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleComplete(habit.id)}
                        >
                          Done
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={isPending}
                        onClick={() => openEdit(habit)}
                        aria-label="Edit habit"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={isPending}
                        onClick={() => handleDelete(habit.id)}
                        aria-label="Remove habit"
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
    </>
  );
}
