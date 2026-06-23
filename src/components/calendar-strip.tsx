"use client";

import { addDays, format, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  daysCount?: number;
}

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  daysCount = 14,
}: CalendarStripProps) {
  const today = new Date();
  const startDate = addDays(today, -3);
  const days = Array.from({ length: daysCount }, (_, i) => addDays(startDate, i));
  const todayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
  }, []);

  return (
    <div className="calendar-strip flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate);
        const todayDay = isToday(day);

        return (
          <motion.button
            key={day.toISOString()}
            ref={todayDay ? todayRef : undefined}
            type="button"
            onClick={() => onSelectDate(day)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "calendar-day flex min-w-[56px] flex-col items-center rounded-xl px-3 py-2 transition-colors",
              selected
                ? "bg-primary text-primary-foreground red-glow"
                : "bg-secondary hover:bg-secondary/80",
              todayDay && !selected && "ring-2 ring-primary/50"
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
              {format(day, "EEE")}
            </span>
            <span className="text-lg font-bold">{format(day, "d")}</span>
            {todayDay && (
              <span className="text-[9px] font-semibold uppercase text-primary">
                {selected ? "Today" : "•"}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
