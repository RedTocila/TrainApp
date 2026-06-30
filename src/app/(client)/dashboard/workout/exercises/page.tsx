import { requireClient } from "@/lib/actions/auth";
import { getPersonalExercisesLibrary } from "@/lib/actions/user-workouts";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { MyExercisesPage } from "@/components/my-exercises-page";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutExercisesPage() {
  await requireClient();
  const [exercises, profile] = await Promise.all([
    getPersonalExercisesLibrary(),
    getSubscriptionProfile(),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <WorkoutPageHeader title="Exercises" />
        <MyExercisesPage initialExercises={exercises} gender={profile?.gender} />
      </div>
    </PageTransition>
  );
}
