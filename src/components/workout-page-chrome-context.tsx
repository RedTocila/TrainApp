"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile } from "@/lib/types";

export type WorkoutPageChromeActions = {
  onStartWorkout: () => void;
  showStart: boolean;
  showCompleted: boolean;
  disabled: boolean;
  isStarting: boolean;
  difficultyExercises: { sets: number }[] | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
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

export function useRegisterWorkoutPageChrome(actions: WorkoutPageChromeActions | null) {
  const context = useContext(WorkoutPageChromeContext);

  useEffect(() => {
    if (!context) return;
    context.setActions(actions);
    return () => context.setActions(null);
  }, [context, actions]);
}
