"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { getWorkoutDayCache } from "@/lib/dashboard-route-cache";
import { formatDateKey } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type {
  CompletedWorkoutResults,
  TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";

function readWorkoutHashKey() {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#workout-(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function WorkoutDayClient({
  clientId,
  gender,
  intakeProfile,
}: {
  clientId: string;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
}) {
  const searchParams = useSearchParams();
  const queryWorkoutKey = searchParams.get("workout");
  const [hashWorkoutKey, setHashWorkoutKey] = useState<string | null>(null);
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const cached = getWorkoutDayCache(clientId, dateKey);
  const highlightWorkoutKey = queryWorkoutKey ?? hashWorkoutKey;

  useEffect(() => {
    setHashWorkoutKey(readWorkoutHashKey());
    const onHashChange = () => setHashWorkoutKey(readWorkoutHashKey());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <DashboardWorkoutCard
      clientId={clientId}
      gender={gender}
      intakeProfile={intakeProfile}
      initialWorkout={(cached?.workouts[0] ?? null) as TodaysWorkoutInfo | null}
      initialWorkouts={cached?.workouts ?? []}
      initialWorkoutCompleted={cached?.allCompleted ?? false}
      initialWorkoutResults={
        (cached?.results ?? null) as CompletedWorkoutResults | null
      }
      selectedWorkoutKey={highlightWorkoutKey}
      variant="detail"
    />
  );
}
