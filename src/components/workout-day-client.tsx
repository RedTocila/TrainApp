"use client";

import { useSelectedDate } from "@/components/date-provider";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { getWorkoutDayCache } from "@/lib/dashboard-route-cache";
import { formatDateKey } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type {
  CompletedWorkoutResults,
  TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";

export function WorkoutDayClient({
  clientId,
  gender,
  intakeProfile,
}: {
  clientId: string;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
}) {
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const cached = getWorkoutDayCache(clientId, dateKey);

  return (
    <DashboardWorkoutCard
      clientId={clientId}
      gender={gender}
      intakeProfile={intakeProfile}
      initialWorkout={(cached?.workout ?? null) as TodaysWorkoutInfo | null}
      initialWorkoutCompleted={cached?.completed ?? false}
      initialWorkoutResults={
        (cached?.results ?? null) as CompletedWorkoutResults | null
      }
      variant="detail"
    />
  );
}
