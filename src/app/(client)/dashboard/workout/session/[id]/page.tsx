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
    redirect("/dashboard/workout");
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
