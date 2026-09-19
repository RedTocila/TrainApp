import { requireClient } from "@/lib/actions/auth";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { WorkoutScheduleView } from "@/components/workout-schedule-view";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutSchedulePage() {
  await requireClient();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <WorkoutPageHeader title="My workout" />
        <WorkoutScheduleView />
      </div>
    </PageTransition>
  );
}
