import { requireClient } from "@/lib/actions/auth";
import { getPersonalWeekPlans } from "@/lib/actions/user-workouts";
import { WeekPlansPage } from "@/components/week-plans-page";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPlansPage() {
  await requireClient();
  const plans = await getPersonalWeekPlans();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <WorkoutPageHeader title="Plans" />
        <WeekPlansPage plans={plans} />
      </div>
    </PageTransition>
  );
}
