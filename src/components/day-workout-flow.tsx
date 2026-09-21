"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  startWorkoutAndRedirect,
  markDayFlowWorkoutSkipped,
  type DayFlowNextWorkout,
} from "@/lib/actions/workout-sessions";
import { isMainWorkoutKind } from "@/lib/hiit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CompleteResult = {
  error?: string;
  scheduledDate?: string;
  taskId?: string;
  planKind?: string;
  nextWorkout?: DayFlowNextWorkout | null;
};

async function startNextSession(
  next: DayFlowNextWorkout,
  router: ReturnType<typeof useRouter>
) {
  const result = await startWorkoutAndRedirect({
    planId: next.planId,
    dayId: next.dayId,
    scheduledDate: next.scheduledDate,
    scheduledWorkoutId: next.scheduledWorkoutId,
  });
  if (result && "sessionId" in result && result.sessionId) {
    router.push(`/dashboard/workout/session/${result.sessionId}`);
    return;
  }
  router.push("/dashboard");
  router.refresh();
}

async function skipStretchSession(
  next: DayFlowNextWorkout,
  router: ReturnType<typeof useRouter>
) {
  await markDayFlowWorkoutSkipped({
    planId: next.planId,
    dayId: next.dayId,
    scheduledDate: next.scheduledDate,
    scheduledWorkoutId: next.scheduledWorkoutId,
    dayTitle: next.dayTitle,
  });
  router.push("/dashboard");
  router.refresh();
}

/**
 * After a session completes: auto-continue warm-up → main.
 * After main → stretch: stay on page and let the user start or skip.
 *
 * Note: completing a session triggers a Next.js refresh of this route. The
 * session page must also render {@link PostWorkoutStretchOffer} for completed
 * mains with a pending stretch, or the offer is wiped by a redirect.
 */
export function useDayWorkoutFlowContinue() {
  const router = useRouter();
  const [stretchOffer, setStretchOffer] = useState<DayFlowNextWorkout | null>(
    null
  );
  const [isContinuing, startContinue] = useTransition();

  const startNext = useCallback(
    (next: DayFlowNextWorkout) => {
      startContinue(async () => {
        await startNextSession(next, router);
      });
    },
    [router]
  );

  const handleAfterComplete = useCallback(
    (result: CompleteResult) => {
      const next = result.nextWorkout ?? null;
      const kind = result.planKind;

      if (kind === "warmup" && next && isMainWorkoutKind(next.planKind)) {
        startNext(next);
        return "continuing" as const;
      }

      if (isMainWorkoutKind(kind) && next && next.planKind === "stretch") {
        setStretchOffer(next);
        return "stretch_offer" as const;
      }

      router.push("/dashboard");
      return "done" as const;
    },
    [router, startNext]
  );

  const dismissStretch = useCallback(() => {
    const next = stretchOffer;
    setStretchOffer(null);
    startContinue(async () => {
      if (next) {
        await skipStretchSession(next, router);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }, [router, stretchOffer]);

  const acceptStretch = useCallback(() => {
    if (!stretchOffer) return;
    const next = stretchOffer;
    setStretchOffer(null);
    startNext(next);
  }, [startNext, stretchOffer]);

  return {
    stretchOffer,
    isContinuing,
    handleAfterComplete,
    dismissStretch,
    acceptStretch,
    StretchOfferDialog: (
      <StretchOfferOverlay
        open={Boolean(stretchOffer)}
        busy={isContinuing}
        dayTitle={stretchOffer?.dayTitle ?? null}
        onAccept={acceptStretch}
        onSkip={dismissStretch}
      />
    ),
  };
}

/** Durable stretch offer after Next.js remounts the completed session page. */
export function PostWorkoutStretchOffer({
  next,
}: {
  next: DayFlowNextWorkout;
}) {
  const router = useRouter();
  const [isContinuing, startContinue] = useTransition();

  const onAccept = () => {
    startContinue(async () => {
      await startNextSession(next, router);
    });
  };

  const onSkip = () => {
    startContinue(async () => {
      await skipStretchSession(next, router);
    });
  };

  return (
    <StretchOfferOverlay
      open
      busy={isContinuing}
      dayTitle={next.dayTitle}
      onAccept={onAccept}
      onSkip={onSkip}
    />
  );
}

/** Warm-up → main: survive the post-complete route refresh and start the main. */
export function AutoContinueDayFlow({ next }: { next: DayFlowNextWorkout }) {
  const router = useRouter();
  const platform = usePlatformCopy();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startContinue] = useTransition();

  const begin = useCallback(() => {
    startedRef.current = true;
    setError(null);
    startContinue(async () => {
      const result = await startWorkoutAndRedirect({
        planId: next.planId,
        dayId: next.dayId,
        scheduledDate: next.scheduledDate,
        scheduledWorkoutId: next.scheduledWorkoutId,
      });
      if (result && "sessionId" in result && result.sessionId) {
        router.push(`/dashboard/workout/session/${result.sessionId}`);
        return;
      }
      startedRef.current = false;
      setError(
        result && "error" in result && typeof result.error === "string"
          ? result.error
          : "Could not start the next workout."
      );
    });
  }, [next, router]);

  useEffect(() => {
    if (startedRef.current) return;
    begin();
  }, [begin]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" onClick={begin} disabled={isPending}>
            {platform.workout.continueToMain}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            {platform.common.cancel}
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {platform.workout.continueToMain}
            {next.dayTitle ? ` · ${next.dayTitle}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

function StretchOfferOverlay({
  open,
  busy,
  dayTitle,
  onAccept,
  onSkip,
}: {
  open: boolean;
  busy: boolean;
  dayTitle?: string | null;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const platform = usePlatformCopy();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <Card className="w-full max-w-sm border-border/60 shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {platform.workout.stretchOfferTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {platform.workout.stretchOfferBody}
          </p>
          {dayTitle ? (
            <p className="pt-1 text-sm font-semibold text-foreground">
              {dayTitle}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pb-5">
          <Button className="w-full" disabled={busy} onClick={onAccept}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {platform.workout.doStretch}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={onSkip}
          >
            {platform.workout.skipStretch}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function isWarmupPlanKind(kind: string | null | undefined) {
  return kind === "warmup";
}
