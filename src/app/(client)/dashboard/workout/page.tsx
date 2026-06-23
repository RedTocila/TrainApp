import { format } from "date-fns";
import { requireClient } from "@/lib/actions/auth";
import { getWorkoutFoldersOverview } from "@/lib/actions/user-workouts";
import {
  getInProgressSession,
  resolveWorkoutForDate,
} from "@/lib/actions/workout-sessions";
import { WorkoutFoldersPage } from "@/components/workout-folders-page";
import { WorkoutTabBanner } from "@/components/workout-tab-banner";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutPage() {
  const profile = await requireClient();
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const [folders, todaysWorkout, inProgress] = await Promise.all([
    getWorkoutFoldersOverview(),
    resolveWorkoutForDate(profile.id, todayKey),
    getInProgressSession(),
  ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-3xl space-y-6">
        <WorkoutTabBanner
          clientId={profile.id}
          initialWorkout={todaysWorkout}
          initialInProgressSessionId={inProgress?.id ?? null}
        />
        <WorkoutFoldersPage folders={folders} />
      </div>
    </PageTransition>
  );
}
