"use client";

import { useEffect } from "react";
import { useDashboardEnrichmentHydrate } from "@/components/dashboard-enrichment-provider";
import { useDashboardScheduleMerge } from "@/components/dashboard-schedule-context";
import {
  setNutritionExtrasCache,
  type NutritionExtrasCache,
} from "@/lib/dashboard-route-cache";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

export function DashboardEnrichmentHydrator({
  data,
}: {
  data: DashboardEnrichmentData;
}) {
  const hydrate = useDashboardEnrichmentHydrate();

  useEffect(() => {
    hydrate(data);
  }, [data, hydrate]);

  return null;
}

export function DashboardNutritionExtrasHydrator({
  clientId,
  extras,
}: {
  clientId: string;
  extras: NutritionExtrasCache;
}) {
  useEffect(() => {
    setNutritionExtrasCache(clientId, extras);
  }, [clientId, extras]);

  return null;
}

export function DashboardScheduleHydrator({
  scheduledNutritionDays,
  habitsByDate,
}: {
  scheduledNutritionDays: ClientSchedule["scheduledNutritionDays"];
  habitsByDate: ClientSchedule["habitsByDate"];
}) {
  const mergeSchedule = useDashboardScheduleMerge();

  useEffect(() => {
    mergeSchedule?.({ scheduledNutritionDays, habitsByDate });
  }, [mergeSchedule, scheduledNutritionDays, habitsByDate]);

  return null;
}
