"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClientSchedule } from "@/lib/daily-tasks";

type DashboardScheduleContextValue = {
  mergeSchedule: (patch: Partial<ClientSchedule>) => void;
};

const DashboardScheduleContext =
  createContext<DashboardScheduleContextValue | null>(null);

export function DashboardScheduleProvider({
  mergeSchedule,
  children,
}: {
  mergeSchedule: (patch: Partial<ClientSchedule>) => void;
  children: ReactNode;
}) {
  return (
    <DashboardScheduleContext.Provider value={{ mergeSchedule }}>
      {children}
    </DashboardScheduleContext.Provider>
  );
}

export function useDashboardScheduleMerge() {
  return useContext(DashboardScheduleContext)?.mergeSchedule;
}
