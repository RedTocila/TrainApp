import { requireClient } from "@/lib/actions/auth";
import { Suspense } from "react";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { WorkoutDayClient } from "@/components/workout-day-client";

export default async function DashboardDayWorkoutPage() {
  const profile = await requireClient();

  return (
    <DashboardDayDetailShell>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-secondary/40" />}>
        <WorkoutDayClient
          clientId={profile.id}
          gender={profile.gender}
          intakeProfile={{
            age: profile.age,
            intake_responses: profile.intake_responses,
          }}
        />
      </Suspense>
    </DashboardDayDetailShell>
  );
}
