import { requireClient } from "@/lib/actions/auth";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { WorkoutDayClient } from "@/components/workout-day-client";

export default async function DashboardDayWorkoutPage() {
  const profile = await requireClient();

  return (
    <DashboardDayDetailShell>
      <WorkoutDayClient
        clientId={profile.id}
        gender={profile.gender}
        intakeProfile={{
          age: profile.age,
          intake_responses: profile.intake_responses,
        }}
      />
    </DashboardDayDetailShell>
  );
}
