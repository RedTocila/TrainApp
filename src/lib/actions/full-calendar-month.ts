"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import { getHabitsScheduledInRange } from "@/lib/actions/habits";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { getScheduledNutritionInRange } from "@/lib/actions/user-nutrition-schedule";
import { getScheduledCardioInRange } from "@/lib/actions/user-cardio";
import { scheduledCardioByDateMap } from "@/lib/cardio-utils";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import type { ScheduledNutritionDay, ScheduledWorkout } from "@/lib/types";

export type FullCalendarMonthSlice = {
  from: string;
  to: string;
  enrichment: DashboardEnrichmentData;
  scheduleSlice: {
    scheduledWorkouts: ScheduledWorkout[];
    scheduledNutritionDays: ScheduledNutritionDay[];
    scheduledCardioByDate: NonNullable<ClientSchedule["scheduledCardioByDate"]>;
    habitsByDate: NonNullable<ClientSchedule["habitsByDate"]>;
  };
};

/**
 * Lazy month fetch for the full calendar — one range round-trip when the user
 * navigates to a month outside the dashboard ±14 day window.
 */
export async function fetchFullCalendarMonthSlice(
  from: string,
  to: string,
  timezoneOffsetMinutes = 0
): Promise<FullCalendarMonthSlice | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [
    enrichment,
    scheduledWorkouts,
    scheduledNutritionDays,
    habitsByDateRaw,
    scheduledCardioEntries,
  ] = await Promise.all([
    fetchDashboardEnrichmentData(
      user.id,
      from,
      to,
      timezoneOffsetMinutes
    ),
    getScheduledWorkoutsInRange(from, to),
    getScheduledNutritionInRange(from, to),
    getHabitsScheduledInRange(user.id, from, to),
    getScheduledCardioInRange(from, to),
  ]);

  const habitsByDate: NonNullable<ClientSchedule["habitsByDate"]> = {};
  for (const [date, habitsOnDay] of Object.entries(habitsByDateRaw)) {
    habitsByDate[date] = habitsOnDay.map((h) => ({
      id: h.id,
      title: h.title,
      time_start: h.time_start,
      time_end: h.time_end,
    }));
  }

  return {
    from,
    to,
    enrichment,
    scheduleSlice: {
      scheduledWorkouts,
      scheduledNutritionDays,
      scheduledCardioByDate: scheduledCardioByDateMap(scheduledCardioEntries),
      habitsByDate,
    },
  };
}
