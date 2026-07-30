"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ProgressPhotosPageChromeActions = {
  onOpenReadMe: () => void;
};

const ProgressPhotosPageChromeContext = createContext<{
  actions: ProgressPhotosPageChromeActions | null;
  setActions: (actions: ProgressPhotosPageChromeActions | null) => void;
} | null>(null);

export function ProgressPhotosPageChromeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [actions, setActions] = useState<ProgressPhotosPageChromeActions | null>(
    null
  );
  const value = useMemo(() => ({ actions, setActions }), [actions]);

  return (
    <ProgressPhotosPageChromeContext.Provider value={value}>
      {children}
    </ProgressPhotosPageChromeContext.Provider>
  );
}

export function useProgressPhotosPageChromeActions() {
  return useContext(ProgressPhotosPageChromeContext)?.actions ?? null;
}

export function useRegisterProgressPhotosPageChrome(
  actions: ProgressPhotosPageChromeActions | null
) {
  const context = useContext(ProgressPhotosPageChromeContext);
  const setActions = context?.setActions;

  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
    return () => setActions(null);
  }, [setActions, actions]);
}
