import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutsWithSchedules,
  getWorkoutFoldersForMove,
} from "@/lib/actions/user-workouts";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { AllWorkoutsPage } from "@/components/all-workouts-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPage() {
  await requireClient();

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
