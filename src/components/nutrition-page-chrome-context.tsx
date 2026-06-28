"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NutritionPageChromeActions = {
  onLogMeal?: () => void;
  onDietPlan: () => void;
  showDietPlan: boolean;
  status?: "completed" | "over" | null;
  /** Status chips shown beside the day-detail back button (e.g. Skipped). */
  headerTrailing?: ReactNode;
};

const NutritionPageChromeContext = createContext<{
  actions: NutritionPageChromeActions | null;
  setActions: (actions: NutritionPageChromeActions | null) => void;
} | null>(null);

export function NutritionPageChromeProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<NutritionPageChromeActions | null>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);

  return (
    <NutritionPageChromeContext.Provider value={value}>
      {children}
    </NutritionPageChromeContext.Provider>
  );
}

export function useNutritionPageChromeActions() {
  return useContext(NutritionPageChromeContext)?.actions ?? null;
}

export function useRegisterNutritionPageChrome(actions: NutritionPageChromeActions | null) {
  const context = useContext(NutritionPageChromeContext);

  useEffect(() => {
    if (!context) return;
    context.setActions(actions);
    return () => context.setActions(null);
  }, [context, actions]);
}
