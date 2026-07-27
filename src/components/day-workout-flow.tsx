"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
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

/**
 * After a session completes: auto-continue warm-up → main,
 * or offer optional stretch after main.
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
        await markDayFlowWorkoutSkipped({
          planId: next.planId,
          dayId: next.dayId,
          scheduledDate: next.scheduledDate,
          scheduledWorkoutId: next.scheduledWorkoutId,
          dayTitle: next.dayTitle,
        });
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
        onAccept={acceptStretch}
        onSkip={dismissStretch}
      />
    ),
  };
}

function StretchOfferOverlay({
  open,
  busy,
  onAccept,
  onSkip,
}: {
  open: boolean;
  busy: boolean;
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
