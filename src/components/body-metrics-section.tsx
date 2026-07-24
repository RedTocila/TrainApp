"use client";

import { useState } from "react";
import { BmiCard } from "@/components/bmi-card";
import { WeightTracker } from "@/components/weight-tracker";
import type { BodyWeightLog } from "@/lib/types";

export function BodyMetricsSection({
  clientId,
  heightCm,
  intakeWeightKg,
  accountCreatedAt,
  initialHistory,
  initialLog,
}: {
  clientId: string;
  heightCm?: number | null;
  intakeWeightKg?: number | null;
  accountCreatedAt?: string | null;
  initialHistory: BodyWeightLog[];
  initialLog: BodyWeightLog | null;
}) {
  const [history, setHistory] = useState(initialHistory);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-5">
      <BmiCard
        heightCm={heightCm}
        intakeWeightKg={intakeWeightKg}
        weightHistory={history}
      />
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
