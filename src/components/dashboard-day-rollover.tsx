"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSelectedDate } from "@/components/date-provider";

/** Soft-refresh server data when the local calendar day rolls over. */
export function DashboardDayRollover() {
  const router = useRouter();
  const { todayKey } = useSelectedDate();
  const previousTodayKey = useRef(todayKey);

  useEffect(() => {
    if (previousTodayKey.current === todayKey) return;
    previousTodayKey.current = todayKey;
    router.refresh();
  }, [todayKey, router]);

  return null;
}
