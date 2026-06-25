"use server";

import { addDays, format } from "date-fns";
import { requireAdmin } from "@/lib/actions/auth";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { getWaterGoal } from "@/lib/actions/logs";
import { getHabitsScheduledInRange } from "@/lib/actions/habits";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { getScheduledCardioInRange } from "@/lib/actions/user-cardio";
import { getScheduledNutritionInRange } from "@/lib/actions/user-nutrition-schedule";
import { scheduledCardioByDateMap } from "@/lib/cardio-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

export interface AdminClientCalendarData {
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
  rangeStart: string;
  rangeEnd: string;
}

export async function getAdminClientCalendarData(
  clientId: string
): Promise<AdminClientCalendarData | null> {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "created_at, target_calories, target_protein, target_carbs, target_fat"
    )
    .eq("id", clientId)
    .single();

  if (!profile) return null;

  const today = new Date();
  const joined = profile.created_at ? new Date(profile.created_at) : today;
  const rangeStart = format(
    joined < addDays(today, -90) ? addDays(today, -90) : joined,
    "yyyy-MM-dd"
  );
  const rangeEnd = format(addDays(today, 60), "yyyy-MM-dd");

  const [
    workoutAssignment,
    nutritionAssignment,
    scheduledWorkouts,
    scheduledNutritionDays,
    habitsByDateRaw,
    scheduledCardioEntries,
    waterGoalMl,
    enrichment,
  ] = await Promise.all([
    getClientWorkoutAssignment(clientId),
    getClientNutritionAssignment(clientId),
    getScheduledWorkoutsInRange(rangeStart, rangeEnd),
    getScheduledNutritionInRange(rangeStart, rangeEnd),
    getHabitsScheduledInRange(clientId, rangeStart, rangeEnd),
    getScheduledCardioInRange(rangeStart, rangeEnd),
    getWaterGoal(clientId),
    fetchDashboardEnrichmentData(clientId, rangeStart, rangeEnd),
  ]);

  const habitsByDate: ClientSchedule["habitsByDate"] = {};
  for (const [date, habitsOnDay] of Object.entries(habitsByDateRaw)) {
    habitsByDate[date] = habitsOnDay.map((h) => ({
      id: h.id,
      title: h.title,
      time_start: h.time_start,
      time_end: h.time_end,
    }));
  }

  const scheduledCardioByDate = Object.fromEntries(
    Object.entries(scheduledCardioByDateMap(scheduledCardioEntries)).map(
      ([date, cardio]) => [
        date,
        { title: cardio.title, duration_minutes: cardio.duration_minutes },
      ]
    )
  );

  return {
    schedule: {
      workoutAssignment,
      nutritionAssignment,
      scheduledWorkouts,
      scheduledNutritionDays,
      scheduledCardioByDate,
      habitsByDate,
      waterGoalMl,
      macroTargets: {
        calories: profile.target_calories ?? 2000,
        protein: profile.target_protein ?? 150,
        carbs: profile.target_carbs ?? 200,
        fat: profile.target_fat ?? 65,
      },
    },
    enrichment,
    rangeStart,
    rangeEnd,
  };
}
