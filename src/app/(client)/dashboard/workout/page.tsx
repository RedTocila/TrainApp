import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutsWithSchedules,
  getWorkoutFoldersForMove,
} from "@/lib/actions/user-workouts";
import { AllWorkoutsPage } from "@/components/all-workouts-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPage() {
  await requireClient();

  const [workouts, folders] = await Promise.all([
    getPersonalWorkoutsWithSchedules(),
    getWorkoutFoldersForMove(),
  ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-3xl space-y-3">
        <AllWorkoutsPage workouts={workouts} folders={folders} />
      </div>
    </PageTransition>
  );
}
