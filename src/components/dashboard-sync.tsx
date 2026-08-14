"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyLivePatch,
  emptyPatchState,
  mergeEnrichmentWithPatches,
  type DashboardLivePatch,
  type DashboardPatchState,
} from "@/lib/dashboard-enrichment-utils";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

interface DashboardSyncContextValue {
  version: number;
  patches: DashboardPatchState;
  patchDashboard: (patch: DashboardLivePatch) => void;
  notifySync: () => void;
  mergeEnrichment: (data: DashboardEnrichmentData) => DashboardEnrichmentData;
}

const DashboardSyncContext = createContext<DashboardSyncContextValue | null>(null);

const SYNC_DEBOUNCE_MS = 600;

export const DASHBOARD_PULL_REFRESH_EVENT = "dashboard:pull-refresh";

export function DashboardSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [patches, setPatches] = useState<DashboardPatchState>(emptyPatchState);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchDashboard = useCallback((patch: DashboardLivePatch) => {
    setPatches((current) => applyLivePatch(current, patch));
  }, []);

  const notifySync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setVersion((v) => v + 1);
    }, SYNC_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const onPullRefresh = () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setVersion((v) => v + 1);
    };
    window.addEventListener(DASHBOARD_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(DASHBOARD_PULL_REFRESH_EVENT, onPullRefresh);
  }, []);

  const mergeEnrichment = useCallback(
    (data: DashboardEnrichmentData) => mergeEnrichmentWithPatches(data, patches),
    [patches]
  );

  const value = useMemo(
    () => ({ version, patches, patchDashboard, notifySync, mergeEnrichment }),
    [version, patches, patchDashboard, notifySync, mergeEnrichment]
  );

  return (
    <DashboardSyncContext.Provider value={value}>
      {children}
    </DashboardSyncContext.Provider>
  );
}

export function useDashboardSync() {
  const ctx = useContext(DashboardSyncContext);
  if (!ctx) {
    throw new Error("useDashboardSync must be used within DashboardSyncProvider");
  }
  return ctx;
}
