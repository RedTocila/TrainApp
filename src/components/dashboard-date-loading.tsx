"use client";

import { useEffect, useRef, useState } from "react";

export function useDashboardDateFetch(
  dateKey: string,
  fetcher: () => Promise<void>,
  deps: unknown[] = []
): boolean {
  const [settledKey, setSettledKey] = useState(dateKey);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;

    void fetcher().finally(() => {
      if (!cancelled) setSettledKey(dateKey);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey encodes refresh triggers
  }, [dateKey, depsKey, fetcher]);

  return settledKey === dateKey;
}
