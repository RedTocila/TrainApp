"use client";

import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { DailyTracker } from "@/components/daily-tracker";
import { getDailyLog } from "@/lib/actions/logs";
import { formatDateKey } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";

export function DashboardOverview({
  clientId,
  initialLog,
  targets,
}: {
  clientId: string;
  initialLog: DailyLog | null;
  targets: { calories: number; protein: number; carbs: number; fat: number };
}) {
  const { selectedDate } = useSelectedDate();
  const [log, setLog] = useState(initialLog);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    startTransition(async () => {
      const fetched = await getDailyLog(clientId, dateKey);
      setLog(fetched);
    });
  }, [selectedDate, clientId]);

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      log={log}
      targets={targets}
    />
  );
}
