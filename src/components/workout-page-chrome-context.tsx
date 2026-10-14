"use client";

import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkoutPageChromeActions = {
  date: Date;
  workout?: TodaysWorkoutInfo | null;
  gender?: string | null;
  continuesToMain?: boolean;
  disabled?: boolean;
  showStart: boolean;
  showEdit?: boolean;
  onEdit?: () => void;
};

const WorkoutPageChromeContext = createContext<{
  actions: WorkoutPageChromeActions | null;
  setActions: (actions: WorkoutPageChromeActions | null) => void;
} | null>(null);

export function WorkoutPageChromeProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<WorkoutPageChromeActions | null>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);

  return (
    <WorkoutPageChromeContext.Provider value={value}>
      {children}
    </WorkoutPageChromeContext.Provider>
  );
}

export function useWorkoutPageChromeActions() {
  return useContext(WorkoutPageChromeContext)?.actions ?? null;
}

export function useRegisterWorkoutPageChrome(
  actions: WorkoutPageChromeActions | null
) {
  const context = useContext(WorkoutPageChromeContext);
  const setActions = context?.setActions;

  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
    return () => setActions(null);
  }, [setActions, actions]);
}
