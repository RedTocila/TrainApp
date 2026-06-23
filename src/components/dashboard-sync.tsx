"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DashboardSyncContextValue {
  version: number;
  notifySync: () => void;
}

const DashboardSyncContext = createContext<DashboardSyncContextValue | null>(null);

export function DashboardSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const notifySync = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ version, notifySync }),
    [version, notifySync]
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
