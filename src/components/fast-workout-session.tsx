"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveHiitClient } from "@/components/active-hiit-client";
import { ActiveWorkoutClient } from "@/components/active-workout-client";
import { SessionBootShell } from "@/components/dashboard-page-skeleton";
import { SessionTopBar } from "@/components/workout-session-ui";
import {
  abandonUnstartedWorkoutSession,
  getWorkoutSession,
  type OpenedWorkout,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { isTimedWorkoutKind, type WorkoutPlanKind } from "@/lib/hiit";
import type { WorkoutSession, WorkoutSessionExercise } from "@/lib/types";
import { moveHiitTimerState } from "@/lib/hiit-timer-storage";
import { moveWorkoutTimerState } from "@/lib/workout-timer-storage";
import {
  openWorkoutSessionCached,
  pendingWorkoutSessionId,
  readStagedWorkoutOpen,
  rememberOpenedSession,
  type StagedWorkoutOpen,
} from "@/lib/staged-workout-open";

function provisionalSession(workout: TodaysWorkoutInfo): WorkoutSession {
  return {
    id: pendingWorkoutSessionId(workout.dayId),
    client_id: "",
    plan_id: workout.planId,
    day_id: workout.dayId,
    scheduled_date: workout.scheduledDate,
    scheduled_workout_id: workout.scheduledWorkoutId ?? null,
    day_title: workout.dayTitle,
    plan_title: workout.planTitle,
    status: "in_progress",
    notes: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
}

function provisionalExercises(
  workout: TodaysWorkoutInfo,
  sessionId: string
): WorkoutSessionExercise[] {
  return workout.exercises.map((exercise, index) => ({
    id: `pending-ex-${exercise.id || index}`,
    session_id: sessionId,
    exercise_id: exercise.id || null,
    name: exercise.name,
    target_sets: exercise.sets,
    target_reps: exercise.reps,
    order_index: index,
    notes: exercise.notes,
    image_url: exercise.image_url ?? null,
    video_url: exercise.video_url ?? null,
    sets: [],
  }));
}

let openWatchers = 0;

export function FastWorkoutSession() {
  const router = useRouter();
  const [staged, setStaged] = useState<StagedWorkoutOpen | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<OpenedWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    setStaged(readStagedWorkoutOpen());
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    if (!staged) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;
    openWatchers += 1;
    const apply = (result: OpenedWorkout) => {
      if (cancelled) {
        const sessionId = result.session?.id;
        const unstarted =
          result.session?.status === "in_progress" && !result.session.started_at;
        if (sessionId && unstarted) {
          window.setTimeout(() => {
            if (openWatchers === 0) void abandonUnstartedWorkoutSession(sessionId);
          }, 1200);
        }
        return;
      }
      if (result.error && result.sessionId && !result.session) {
        router.replace(`/dashboard/workout/session/${result.sessionId}`);
        return;
      }
      if (result.session && result.session.status !== "in_progress") {
        router.replace("/dashboard");
        return;
      }
      if (result.error && !result.session) {
        setError(result.error);
        return;
      }
      if (result.session?.id) rememberOpenedSession(result.session.id);
      setLive(result);
    };

    if (staged.sessionId) {
      void getWorkoutSession(staged.sessionId).then((data) => {
        if (!data) {
          apply({ error: "Workout not found" });
          return;
        }
        apply({
          sessionId: data.session.id,
          session: data.session,
          exercises: data.exercises,
          planKind: data.planKind,
          hiitConfig: data.hiitConfig,
        });
      });
    } else {
      void openWorkoutSessionCached(staged).then(apply);
    }

    return () => {
      cancelled = true;
      openWatchers -= 1;
    };
  }, [ready, router, staged]);

  const workout = staged?.workout ?? null;
  const pendingId = workout ? pendingWorkoutSessionId(workout.dayId) : "";
  const liveSessionId = live?.session?.id ?? null;

  useLayoutEffect(() => {
    if (!pendingId || !liveSessionId || pendingId === liveSessionId) return;
    moveWorkoutTimerState(pendingId, liveSessionId);
    moveHiitTimerState(pendingId, liveSessionId);
  }, [liveSessionId, pendingId]);

  const previewSession = useMemo(
    () => (workout ? provisionalSession(workout) : null),
    [workout]
  );
  const previewExercises = useMemo(
    () =>
      workout && previewSession
        ? provisionalExercises(workout, previewSession.id)
        : [],
    [previewSession, workout]
  );

  if (!ready || !staged || !workout || !previewSession) {
    return <SessionBootShell />;
  }

  const planKind = (live?.planKind ?? workout.planKind ?? "strength") as WorkoutPlanKind;
  const hiitConfig = live?.hiitConfig ?? workout.hiitConfig ?? null;
  // Warm-up, stretch, and HIIT run on the interval clock. Their day rows also
  // list those moves, which used to paint the strength overview for a second.
  const timedSession = isTimedWorkoutKind(planKind) || Boolean(hiitConfig);

  if (timedSession && hiitConfig) {
    return (
      <ActiveHiitClient
        session={live?.session ?? previewSession}
        config={hiitConfig}
        planKind={isTimedWorkoutKind(planKind) ? planKind : "hiit"}
        gender={staged.gender}
        continuesToMain={staged.continuesToMain}
      />
    );
  }

  const waitingForInterval = timedSession && !live?.session;

  if (waitingForInterval && !error) {
    return <SessionBootShell variant="timer" />;
  }

  if (waitingForInterval) {
    return (
      <div
        data-native-pull-refresh="off"
        className="mx-auto flex h-[100dvh] max-h-[100dvh] max-w-lg flex-col px-2 pt-[max(0.35rem,var(--safe-area-top))]"
      >
        <SessionTopBar
          title={workout.dayTitle || workout.planTitle}
          subtitle={
            workout.planTitle !== workout.dayTitle ? workout.planTitle : null
          }
          onBack={() => router.push("/dashboard")}
        />
        {error ? (
          <p className="px-3 pt-4 text-sm text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  const session = live?.session ?? previewSession;
  const exercises =
    live?.exercises && live.exercises.length > 0 ? live.exercises : previewExercises;

  return (
    <>
      {error ? (
        <p className="px-3 pt-2 text-sm text-red-400">{error}</p>
      ) : null}
      <ActiveWorkoutClient
        session={session}
        exercises={exercises}
        gender={staged.gender}
        planKind={planKind}
      />
    </>
  );
}
