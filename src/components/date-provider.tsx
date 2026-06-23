"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const DateContext = createContext<{
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
} | null>(null);

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
}

export function useSelectedDate() {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error("useSelectedDate must be used within DateProvider");
  return ctx;
}
