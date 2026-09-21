import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import {
  getNextDayFlowWorkout,
  getWorkoutSession,
} from "@/lib/actions/workout-sessions";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { ActiveWorkoutClient } from "@/components/active-workout-client";
import { ActiveHiitClient } from "@/components/active-hiit-client";
import { PageTransition } from "@/components/page-transition";
import { PostWorkoutStretchOffer, AutoContinueDayFlow } from "@/components/day-workout-flow";
import { isMainWorkoutKind } from "@/lib/hiit";

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const [data, profile] = await Promise.all([
    getWorkoutSession(id),
    getSubscriptionProfile(),
  ]);

  if (!data) notFound();

  const { session, exercises, hiitConfig, planKind } = data;

  if (session.status === "completed") {
    // Completing a session refreshes this route. Keep day-flow UI here instead
    // of bouncing home before warm-up→main or the stretch offer can run.
    if (session.scheduled_date) {
      const next = await getNextDayFlowWorkout(
        session.scheduled_date,
        planKind
      );
      if (planKind === "warmup" && next && isMainWorkoutKind(next.planKind)) {
        return (
          <PageTransition>
            <AutoContinueDayFlow next={next} />
          </PageTransition>
        );
      }
      if (isMainWorkoutKind(planKind) && next?.planKind === "stretch") {
        return (
          <PageTransition>
            <div className="min-h-[70vh] bg-background" />
            <PostWorkoutStretchOffer next={next} />
          </PageTransition>
        );
      }
    }
    redirect("/dashboard");
  }

  if (session.status === "cancelled") {
    notFound();
  }

  const continuesToMain =
    planKind === "warmup" && session.scheduled_date
      ? await getNextDayFlowWorkout(session.scheduled_date, "warmup").then(
          (next) => Boolean(next && isMainWorkoutKind(next.planKind))
        )
      : false;

  // HIIT, warm-up, and stretching all run on the interval timer.
  if (hiitConfig) {
    return (
      <PageTransition>
        <ActiveHiitClient
          session={session}
          config={hiitConfig}
          planKind={planKind}
          gender={profile?.gender}
          continuesToMain={continuesToMain}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <ActiveWorkoutClient
        session={session}
        exercises={exercises}
        gender={profile?.gender}
        planKind={planKind}
      />
    </PageTransition>
  );
}
