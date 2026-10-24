"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BmiCard } from "@/components/bmi-card";
import { DashboardStepsCard } from "@/components/dashboard-steps-card";
import { WeightTracker } from "@/components/weight-tracker";
import type { BodyWeightLog } from "@/lib/types";

export function BodyMetricsSection({
  clientId,
  heightCm,
  intakeWeightKg,
  accountCreatedAt,
  initialHistory,
  initialLog,
  stepGoal,
}: {
  clientId: string;
  heightCm?: number | null;
  intakeWeightKg?: number | null;
  accountCreatedAt?: string | null;
  initialHistory: BodyWeightLog[];
  initialLog: BodyWeightLog | null;
  stepGoal?: number | null;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [showSteps, setShowSteps] = useState(process.env.NODE_ENV === "development");

  useEffect(() => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      setShowSteps(true);
    }
  }, []);

  const bmiCard = (
    <BmiCard
      heightCm={heightCm}
      intakeWeightKg={intakeWeightKg}
      weightHistory={history}
    />
  );

  return (
    <div className="flex shrink-0 flex-col gap-4 sm:gap-5 md:gap-5">
      {showSteps ? (
        <div className="flex w-full items-stretch gap-3.5 sm:gap-4 md:gap-5">
          <div className="w-1/2 min-w-0">
            <DashboardStepsCard initialGoal={stepGoal} />
          </div>
          <div className="w-1/2 min-w-0">{bmiCard}</div>
        </div>
      ) : (
        <div className="w-full min-w-0">{bmiCard}</div>
      )}
      <WeightTracker
        clientId={clientId}
        intakeWeightKg={intakeWeightKg}
        startDate={accountCreatedAt?.slice(0, 10) ?? null}
        initialHistory={initialHistory}
        initialLog={initialLog}
        onHistoryChange={setHistory}
      />
    </div>
  );
}
