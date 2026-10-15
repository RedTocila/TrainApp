"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveHiitClient } from "@/components/active-hiit-client";
import { ActiveWorkoutClient } from "@/components/active-workout-client";
import { WorkoutOpenSkeleton } from "@/components/dashboard-page-skeleton";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import {
  getInProgressSession,
  getWorkoutSession,
} from "@/lib/actions/workout-sessions";
import type { WorkoutPlanKind } from "@/lib/hiit";
import type { WorkoutSession, WorkoutSessionExercise } from "@/lib/types";

type ReadyWorkout = {
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
  planKind: WorkoutPlanKind;
  hiitConfig: import("@/lib/hiit").HiitConfig | null;
  gender: string | null;
};

/** Lock Screen opens this while the in-progress workout is still loading. */
export function LiveWorkoutGate() {
  const router = useRouter();
  const [ready, setReady] = useState<ReadyWorkout | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [session, profile] = await Promise.all([
        getInProgressSession(),
        getSubscriptionProfile(),
      ]);
      if (cancelled) return;
      if (!session?.id) {
        router.replace("/dashboard");
        return;
      }
      const details = await getWorkoutSession(session.id);
      if (cancelled) return;
      if (!details || details.session.status !== "in_progress") {
        router.replace("/dashboard");
        return;
      }
      setReady({
        session: details.session,
        exercises: details.exercises,
        planKind: details.planKind,
        hiitConfig: details.hiitConfig,
        gender: profile?.gender ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <WorkoutOpenSkeleton />;

  if (ready.hiitConfig) {
    return (
      <ActiveHiitClient
        session={ready.session}
        config={ready.hiitConfig}
        planKind={ready.planKind}
        gender={ready.gender}
      />
    );
  }

  return (
    <ActiveWorkoutClient
      session={ready.session}
      exercises={ready.exercises}
      gender={ready.gender}
      planKind={ready.planKind}
    />
  );
}
