"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { startOfDay } from "date-fns";
import { formatDateKey } from "@/lib/utils";

/** Selected calendar day — drives the whole dashboard view. */
const DateContext = createContext<{
  selectedDate: Date;
  todayKey: string;
  setSelectedDate: (date: Date) => void;
  goToToday: () => void;
} | null>(null);

function todayStart() {
  return startOfDay(new Date());
}

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState(todayStart);
  const [todayKey, setTodayKey] = useState(() => formatDateKey(new Date()));
  const pinnedToTodayRef = useRef(true);

  const setSelectedDate = useCallback((date: Date) => {
    const normalized = startOfDay(date);
    const nextTodayKey = formatDateKey(new Date());
    pinnedToTodayRef.current = formatDateKey(normalized) === nextTodayKey;
    setSelectedDateState(normalized);
  }, []);

  const goToToday = useCallback(() => {
    pinnedToTodayRef.current = true;
    const now = todayStart();
    setTodayKey(formatDateKey(now));
    setSelectedDateState(now);
  }, []);

  useEffect(() => {
    const syncWithClock = () => {
      const now = todayStart();
      const nextTodayKey = formatDateKey(now);
      setTodayKey((current) => (current === nextTodayKey ? current : nextTodayKey));

      if (!pinnedToTodayRef.current) return;
      setSelectedDateState((current) =>
        formatDateKey(current) === nextTodayKey ? current : now
      );
    };

    syncWithClock();
    const intervalId = setInterval(syncWithClock, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncWithClock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <DateContext.Provider
      value={{
        selectedDate,
        todayKey,
        setSelectedDate,
        goToToday,
      }}
    >
      {children}
    </DateContext.Provider>
  );
}

export function useSelectedDate() {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error("useSelectedDate must be used within DateProvider");
  return ctx;
}
