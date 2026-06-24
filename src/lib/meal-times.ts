import type { DailyMealLog, Meal } from "@/lib/types";
import { formatTimeValue } from "@/lib/habit-utils";
import {
  MEAL_SLOTS,
  groupMealsBySlot,
  slotLabel,
  type MealSlot,
} from "@/lib/meal-slots";
import { formatDateKey } from "@/lib/utils";

export const MEAL_SLOT_WINDOWS: Record<MealSlot, { start: string; end: string }> = {
  breakfast: { start: "07:00", end: "09:30" },
  snack_1: { start: "10:00", end: "11:00" },
  lunch: { start: "12:00", end: "14:00" },
  snack_2: { start: "15:00", end: "16:30" },
  dinner: { start: "18:00", end: "20:30" },
};

/** Latest time to finish a scheduled workout on the same day. */
export const WORKOUT_DEADLINE = "20:00";

/** Latest time to reach the daily water goal. */
export const WATER_DEADLINE = "21:00";

export type MealSlotPhase = "upcoming" | "active" | "missed";

export type MealSlotStatus = "completed" | "missed" | "upcoming" | "due";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Which meal slot window the given clock time falls in (local time). */
export function inferMealSlotFromTime(now: Date = new Date()): MealSlot | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const { slot } of MEAL_SLOTS) {
    const { start, end } = MEAL_SLOT_WINDOWS[slot];
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (minutes >= startMin && minutes <= endMin) {
      return slot;
    }
  }
  return null;
}

/** Infer slot from when the meal was logged (uses time-of-day from logged_at). */
export function inferMealSlotFromLoggedAt(loggedAt: string): MealSlot | null {
  const d = new Date(loggedAt);
  if (Number.isNaN(d.getTime())) return null;
  return inferMealSlotFromTime(d);
}

/**
 * Pick the meal slot for a new log: current time window first (today only),
 * then meal type, then next open snack slot.
 */
export function resolveMealSlotForLog(
  existingLogs: DailyMealLog[],
  mealType: DailyMealLog["meal_type"],
  dateKey: string,
  now: Date = new Date()
): MealSlot | null {
  if (dayRelation(dateKey, now) === "today") {
    const fromTime = inferMealSlotFromTime(now);
    if (fromTime) return fromTime;
  }

  const filled = mapDailyMealsToSlots(existingLogs);

  if (mealType === "breakfast") return "breakfast";
  if (mealType === "lunch") return "lunch";
  if (mealType === "dinner") return "dinner";

  if (mealType === "snack") {
    if (!filled.has("snack_1")) return "snack_1";
    if (!filled.has("snack_2")) return "snack_2";
    return "snack_2";
  }

  return null;
}

export function formatMealSlotWindow(slot: MealSlot): string {
  const { start, end } = MEAL_SLOT_WINDOWS[slot];
  return `${formatTimeValue(start)} – ${formatTimeValue(end)}`;
}

export function dayRelation(
  dateKey: string,
  now: Date = new Date()
): "past" | "today" | "future" {
  const todayKey = formatDateKey(now);
  if (dateKey < todayKey) return "past";
  if (dateKey > todayKey) return "future";
  return "today";
}

/** True once the daily schedule window has closed (past calendar day or after water deadline). */
export function isDayEnded(dateKey: string, now: Date = new Date()): boolean {
  const relation = dayRelation(dateKey, now);
  if (relation === "past") return true;
  if (relation === "future") return false;
  return isDeadlinePassed(WATER_DEADLINE, dateKey, now);
}

export function getMealSlotPhase(
  slot: MealSlot,
  dateKey: string,
  now: Date = new Date()
): MealSlotPhase {
  const relation = dayRelation(dateKey, now);
  if (relation === "future") return "upcoming";
  if (relation === "past") return "missed";

  const { end } = MEAL_SLOT_WINDOWS[slot];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes > parseTimeToMinutes(end)) return "missed";
  return "active";
}

export function isDeadlinePassed(
  deadline: string,
  dateKey: string,
  now: Date = new Date()
): boolean {
  const relation = dayRelation(dateKey, now);
  if (relation === "past") return true;
  if (relation === "future") return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > parseTimeToMinutes(deadline);
}

export function mapDailyMealsToSlots(logs: DailyMealLog[]): Set<MealSlot> {
  const slots = new Set<MealSlot>();
  const snacks: DailyMealLog[] = [];

  for (const log of logs) {
    if (log.slot) {
      slots.add(log.slot as MealSlot);
      continue;
    }
    const fromLoggedAt = inferMealSlotFromLoggedAt(log.logged_at);
    if (fromLoggedAt) {
      slots.add(fromLoggedAt);
      continue;
    }
    if (log.meal_type === "breakfast") slots.add("breakfast");
    else if (log.meal_type === "lunch") slots.add("lunch");
    else if (log.meal_type === "dinner") slots.add("dinner");
    else if (log.meal_type === "snack") snacks.push(log);
  }

  snacks.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  if (snacks[0] && !slots.has("snack_1")) slots.add("snack_1");
  if (snacks.length > 1 && !slots.has("snack_2")) slots.add("snack_2");

  return slots;
}

export function canToggleMealSlot(dateKey: string, now: Date = new Date()): boolean {
  return dayRelation(dateKey, now) !== "future";
}

/** True when the user may mark a slot eaten (not after the window closes). Logged slots may undo. */
export function canMarkMealSlotAsEaten(
  slot: MealSlot,
  dateKey: string,
  isLogged: boolean,
  now: Date = new Date()
): boolean {
  if (dayRelation(dateKey, now) === "future") return false;
  if (isLogged) return true;
  return getMealSlotPhase(slot, dateKey, now) !== "missed";
}

export function isMealSlotLogged(slot: MealSlot, dailyMeals: DailyMealLog[]): boolean {
  return mapDailyMealsToSlots(dailyMeals).has(slot);
}

export interface PlannedMealSlot {
  slot: MealSlot;
  label: string;
  meal: Meal | null;
  options: Meal[];
  loggedMeal: DailyMealLog | null;
  timeWindow: string;
  status: MealSlotStatus;
}

export function getPlannedMealSlots(
  planMeals: Meal[],
  dailyMeals: DailyMealLog[],
  dateKey: string,
  activeSlots?: MealSlot[] | null,
  now: Date = new Date()
): PlannedMealSlot[] {
  const grouped = groupMealsBySlot(planMeals);
  const loggedSlots = mapDailyMealsToSlots(dailyMeals);

  return MEAL_SLOTS.map(({ slot, label }) => {
    const options = grouped[slot];
    const slotLog =
      dailyMeals.find((m) => m.slot === slot) ??
      dailyMeals.find(
        (m) => !m.slot && inferMealSlotFromLoggedAt(m.logged_at) === slot
      ) ??
      null;
    const meal =
      slotLog?.source_meal_id
        ? options.find((m) => m.id === slotLog.source_meal_id) ??
          ({
            id: slotLog.source_meal_id,
            plan_id: "",
            meal_type: slotLog.meal_type,
            slot,
            name: slotLog.name,
            description: slotLog.description,
            youtube_url: null,
            calories: slotLog.calories,
            protein: slotLog.protein,
            carbs: slotLog.carbs,
            fat: slotLog.fat,
            foods: slotLog.foods,
            order_index: 0,
          } as Meal)
        : options[0] ?? null;
    const timeWindow = formatMealSlotWindow(slot);
    const logged = loggedSlots.has(slot);

    let status: MealSlotStatus;
    if (logged) {
      status = "completed";
    } else if (options.length === 0) {
      status = "upcoming";
    } else {
      const phase = getMealSlotPhase(slot, dateKey, now);
      status = phase === "missed" ? "missed" : phase === "upcoming" ? "upcoming" : "due";
    }

    return { slot, label, meal, options, loggedMeal: slotLog, timeWindow, status };
  }).filter((entry) => {
    if (entry.options.length === 0) return false;
    if (activeSlots && activeSlots.length > 0) {
      return activeSlots.includes(entry.slot);
    }
    return true;
  });
}

export function countMissedMealSlots(slots: PlannedMealSlot[]): number {
  return slots.filter((s) => s.status === "missed").length;
}

export function getNutritionDayStatus(
  planMeals: Meal[],
  dailyMeals: DailyMealLog[],
  dateKey: string,
  now: Date = new Date()
) {
  const slots = getPlannedMealSlots(planMeals, dailyMeals, dateKey, null, now);
  const planned = slots.filter((s) => s.meal);
  const doneCount = planned.filter((s) => s.status === "completed").length;
  const missedCount = planned.filter((s) => s.status === "missed").length;

  return {
    total: planned.length,
    doneCount,
    missedCount,
    completed: planned.length > 0 && doneCount === planned.length,
    missed: planned.length > 0 && missedCount > 0 && doneCount < planned.length,
  };
}

export function mealAttentionMessage(missedCount: number): string | null {
  if (missedCount <= 0) return null;
  if (missedCount === 1) {
    return "You missed a meal today — try to eat on schedule next time.";
  }
  return `You missed ${missedCount} meals today — eat on schedule tomorrow.`;
}

export function workoutAttentionMessage(missed: boolean): string | null {
  if (!missed) return null;
  return "You missed today's workout — try to train earlier tomorrow.";
}

export function habitsAttentionMessage(missedCount: number): string | null {
  if (missedCount <= 0) return null;
  if (missedCount === 1) {
    return "You missed a habit today — stick to your schedule tomorrow.";
  }
  return `You missed ${missedCount} habits today — stay consistent tomorrow.`;
}

export function waterAttentionMessage(missed: boolean): string | null {
  if (!missed) return null;
  return "You didn't reach your water goal — keep a bottle nearby and sip throughout the day.";
}

export function mealSlotStatusLabel(status: MealSlotStatus): string | undefined {
  switch (status) {
    case "completed":
      return "Ate";
    case "missed":
      return "Missed";
    case "due":
      return "Due now";
    case "upcoming":
      return undefined;
  }
}

export function mealSlotTaskLabel(slot: MealSlot, mealName: string): string {
  return `${slotLabel(slot)}: ${mealName}`;
}
