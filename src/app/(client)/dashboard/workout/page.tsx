import { requireClient } from "@/lib/actions/auth";
import { getWorkoutFoldersOverview } from "@/lib/actions/user-workouts";
import { getClientPlanRequests } from "@/lib/actions/custom-plans";
import { WorkoutFoldersPage } from "@/components/workout-folders-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPage() {
  const profile = await requireClient();

  const [folders, planRequests] = await Promise.all([
    getWorkoutFoldersOverview(),
    getClientPlanRequests(profile.id),
  ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-3xl space-y-6">
        <WorkoutFoldersPage folders={folders} planRequests={planRequests} />
      </div>
    </PageTransition>
  );
}
