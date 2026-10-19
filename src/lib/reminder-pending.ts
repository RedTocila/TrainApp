import { cardioTaskId } from "@/lib/cardio-task-id";
import {
  REMINDER_TYPES,
  type ReminderSettings,
  type ReminderType,
} from "@/lib/reminder-settings";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import { workoutTaskId } from "@/lib/workout-task-id";

export type ScheduledWorkoutRef = {
  id: string;
  planId: string;
  dayId: string;
};

export type WorkoutSessionRef = {
  scheduledWorkoutId: string | null;
  planId: string | null;
  dayId: string | null;
  status: string;
  notes: string | null;
};

export type DayReminderFacts = {
  settings: ReminderSettings;
  mealsLogged: boolean;
  waterMl: number;
  waterGoalMl: number;
  workoutsOpen: boolean;
  cardioOpen: boolean;
  habitsOpen: boolean;
};

function sessionCloses(
  session: WorkoutSessionRef,
  workout: { id?: string; planId: string; dayId: string }
): "completed" | "skipped" | null {
  const matches =
    (workout.id != null && session.scheduledWorkoutId === workout.id) ||
    (session.planId === workout.planId && session.dayId === workout.dayId);
  if (!matches) return null;
  if (session.status === "completed") return "completed";
  if (session.status === "cancelled" && session.notes === "skipped") return "skipped";
  return null;
}

/** True when a scheduled workout for today is neither completed nor skipped. */
export function scheduledWorkoutsStillOpen(input: {
  dateKey: string;
  scheduled: ScheduledWorkoutRef[];
  sessions: WorkoutSessionRef[];
  taskIds: Set<string>;
}): boolean {
  if (input.scheduled.length === 0) return false;
  return input.scheduled.some((workout) => {
    if (input.taskIds.has(workoutTaskId(input.dateKey, workout.id))) return false;
    const closed = input.sessions.some(
      (session) => sessionCloses(session, workout) != null
    );
    return !closed;
  });
}

/** Legacy weekday rotation: a plan is assigned and the user has no explicit calendar. */
export function legacyWorkoutStillOpen(input: {
  dateKey: string;
  planId: string;
  dayId: string;
  sessions: WorkoutSessionRef[];
  taskIds: Set<string>;
}): boolean {
  if (input.taskIds.has(workoutTaskId(input.dateKey, null))) return false;
  const closed = input.sessions.some(
    (session) =>
      sessionCloses(session, { planId: input.planId, dayId: input.dayId }) != null
  );
  return !closed;
}

export function cardioStillOpen(input: {
  dateKey: string;
  cardioIds: string[];
  taskIds: Set<string>;
}): boolean {
  if (input.cardioIds.length === 0) return false;
  const legacy = cardioTaskId(input.dateKey);
  return input.cardioIds.some(
    (id) =>
      !input.taskIds.has(cardioTaskId(input.dateKey, id)) &&
      !input.taskIds.has(legacy)
  );
}

export function habitsStillOpen(input: {
  habitIds: string[];
  completedHabitIds: Set<string>;
}): boolean {
  return (
    input.habitIds.length > 0 &&
    input.habitIds.some((id) => !input.completedHabitIds.has(id))
  );
}

/**
 * Split today's enabled tasks into due, still open, and already done.
 * A type with nothing scheduled (no workout, cardio, or habit today) is not due.
 * Meals and water count whenever that reminder is on.
 */
export function reminderDaySplit(input: {
  settings: ReminderSettings;
  due: Record<ReminderType, boolean>;
  open: Record<ReminderType, boolean>;
}): { due: ReminderType[]; open: ReminderType[]; done: ReminderType[] } {
  const due: ReminderType[] = [];
  const open: ReminderType[] = [];
  if (!input.settings.enabled) return { due, open, done: [] };
  for (const type of REMINDER_TYPES) {
    if (!input.settings[type].enabled || !input.due[type]) continue;
    due.push(type);
    if (input.open[type]) open.push(type);
  }
  return {
    due,
    open,
    done: due.filter((type) => !open.includes(type)),
  };
}

/** Enabled reminder types that are still unfinished. Empty means do not notify. */
export function openReminderTypes(facts: DayReminderFacts): ReminderType[] {
  if (!facts.settings.enabled) return [];
  const open: ReminderType[] = [];
  for (const type of REMINDER_TYPES) {
    if (!facts.settings[type].enabled) continue;
    if (type === "workout" && facts.workoutsOpen) open.push(type);
    if (type === "meals" && !facts.mealsLogged) open.push(type);
    if (type === "cardio" && facts.cardioOpen) open.push(type);
    if (
      type === "water" &&
      !waterMetDailyMinimum(facts.waterMl, facts.waterGoalMl)
    ) {
      open.push(type);
    }
    if (type === "habits" && facts.habitsOpen) open.push(type);
  }
  return open;
}
