"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2 } from "lucide-react";
import { ensureStarterWorkoutForCurrentUser } from "@/lib/actions/onboarding-workout";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

type Phase = "building" | "ready" | "error";

/**
 * Blocks the dashboard until the first questionnaire's workout is on the calendar.
 */
export function StarterWorkoutGate() {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("building");
  const [detail, setDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const copyRef = useRef(platform);
  const routerRef = useRef(router);
  copyRef.current = platform;
  routerRef.current = router;

  useEffect(() => {
    let cancelled = false;

    void ensureStarterWorkoutForCurrentUser().then((result) => {
      if (cancelled) return;
      if (result.built) {
        setDetail(
          copyRef.current.profile.workoutReadyDetail(
            result.title,
            result.daysPerWeek,
            result.sessionsScheduled
          )
        );
        setPhase("ready");
        return;
      }
      if (
        "skipped" in result &&
        result.skipped &&
        (result.reason === "already_has_program" || result.reason === "intake_incomplete")
      ) {
        routerRef.current.refresh();
        return;
      }
      setPhase("error");
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const startTraining = () => {
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy={phase === "building"}
    >
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          {phase === "building" ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          ) : null}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            {phase === "building" ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Dumbbell className="h-7 w-7" />
            )}
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-black tracking-tight">
          {phase === "ready"
            ? platform.profile.workoutReadyTitle
            : platform.profile.buildingWorkoutTitle}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {phase === "ready"
            ? platform.profile.workoutOnCalendarReady
            : phase === "error"
              ? platform.profile.workoutProgramFailed
              : platform.profile.buildingWorkoutBody}
        </p>
        {phase === "building" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {platform.profile.addingToCalendar}
          </p>
        ) : null}
        {detail ? (
          <p className="mt-3 text-sm font-medium text-foreground">{detail}</p>
        ) : null}

        {phase === "ready" ? (
          <Button className="mt-6 w-full" size="lg" onClick={startTraining}>
            {platform.profile.startTraining}
          </Button>
        ) : null}
        {phase === "error" ? (
          <Button
            className="mt-6 w-full"
            variant="outline"
            onClick={() => {
              setDetail(null);
              setPhase("building");
              setAttempt((n) => n + 1);
            }}
          >
            {platform.profile.workoutBuildRetry}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
