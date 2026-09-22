import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutsWithSchedules,
  getWorkoutFoldersForMove,
} from "@/lib/actions/user-workouts";
import { cleanupBrokenExampleDayWorkouts } from "@/lib/actions/example-week-plan";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { AllWorkoutsPage } from "@/components/all-workouts-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPage() {
  await requireClient();
  // Drop empty leftover example shells (no exercises → no muscle map).
  await cleanupBrokenExampleDayWorkouts();

  const [workouts, folders, profile] = await Promise.all([
    getPersonalWorkoutsWithSchedules(),
    getWorkoutFoldersForMove(),
    getSubscriptionProfile(),
  ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-3xl space-y-3">
        <AllWorkoutsPage
          workouts={workouts}
          folders={folders}
          gender={profile?.gender}
        />
      </div>
    </PageTransition>
  );
}
