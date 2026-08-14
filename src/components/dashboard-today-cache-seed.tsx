"use client";

import { useEffect } from "react";
import {
  setOverviewDayCache,
  setWorkoutDayCache,
  type OverviewDayCache,
  type WorkoutDayCache,
} from "@/lib/dashboard-route-cache";

/** Seed in-memory caches so day workout/nutrition tabs skip a refetch. */
export function DashboardTodayCacheSeed({
  clientId,
  dateKey,
  workout,
  overview,
}: {
  clientId: string;
  dateKey: string;
  workout: WorkoutDayCache;
  overview: OverviewDayCache;
}) {
  useEffect(() => {
    setWorkoutDayCache(clientId, dateKey, workout);
    setOverviewDayCache(clientId, dateKey, overview);
    // Seed once per day; ignore object identity from the parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateKey is the snapshot key
  }, [clientId, dateKey]);

  return null;
}
