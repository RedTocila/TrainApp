import { requireClient } from "@/lib/actions/auth";
import {
  getCompletedWorkoutResultsForDate,
  isWorkoutCompletedOnDate,
  resolveWorkoutForDate,
} from "@/lib/actions/workout-sessions";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { formatDateKey } from "@/lib/utils";

export default async function DashboardDayWorkoutPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);

  const [initialWorkout, initialWorkoutCompleted] = await Promise.all([
    resolveWorkoutForDate(profile.id, dateKey),
    isWorkoutCompletedOnDate(profile.id, dateKey),
  ]);

  const initialWorkoutResults = initialWorkoutCompleted
    ? await getCompletedWorkoutResultsForDate(profile.id, dateKey)
    : null;

  return (
    <DashboardDayDetailShell>
      <DashboardWorkoutCard
        clientId={profile.id}
        gender={profile.gender}
        intakeProfile={{
          age: profile.age,
          intake_responses: profile.intake_responses,
        }}
        initialWorkout={initialWorkout}
        initialWorkoutCompleted={initialWorkoutCompleted}
        initialWorkoutResults={initialWorkoutResults}
        variant="detail"
      />
    </DashboardDayDetailShell>
  );
}
