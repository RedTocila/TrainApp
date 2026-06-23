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
  setSelectedDate: (date: Date) => void;
  goToToday: () => void;
} | null>(null);

function todayStart() {
  return startOfDay(new Date());
}

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState(todayStart);
  const pinnedToTodayRef = useRef(true);

  const setSelectedDate = useCallback((date: Date) => {
    const normalized = startOfDay(date);
    const todayKey = formatDateKey(new Date());
    pinnedToTodayRef.current = formatDateKey(normalized) === todayKey;
    setSelectedDateState(normalized);
  }, []);

  const goToToday = useCallback(() => {
    pinnedToTodayRef.current = true;
    setSelectedDateState(todayStart());
  }, []);

  useEffect(() => {
    const syncWithClock = () => {
      if (!pinnedToTodayRef.current) return;
      const now = todayStart();
      const todayKey = formatDateKey(now);
      setSelectedDateState((current) =>
        formatDateKey(current) === todayKey ? current : now
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
