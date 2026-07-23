"use client";

import { DashboardHomeShell } from "@/components/dashboard-home-shell";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { DashboardOverview } from "@/components/dashboard-overview";
import { DashboardWaterCard } from "@/components/dashboard-water-card";
import { DashboardCardioCard } from "@/components/dashboard-cardio-card";
import { BodyMetricsSection } from "@/components/body-metrics-section";
import { ProgressPhotosCard } from "@/components/progress-photos-card";
import { HabitsTracker } from "@/components/habits-tracker";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { ComponentProps } from "react";

type WorkoutProps = ComponentProps<typeof DashboardWorkoutCard>;
type OverviewProps = ComponentProps<typeof DashboardOverview>;
type WaterProps = ComponentProps<typeof DashboardWaterCard>;
type CardioProps = ComponentProps<typeof DashboardCardioCard>;
type BodyProps = ComponentProps<typeof BodyMetricsSection>;
type PhotosProps = ComponentProps<typeof ProgressPhotosCard>;
type HabitsProps = ComponentProps<typeof HabitsTracker>;

/**
 * Client boundary for home day pages — render-prop stays on the client so
 * Server Components never pass a function across the RSC boundary.
 */
export function DashboardHomeView({
  clientId,
  schedule,
  accountCreatedAt,
  gender,
  initialWorkout,
  initialWorkouts,
  initialWorkoutCompleted,
  initialWorkoutResults,
  initialLog,
  initialDailyMeals,
  mealLibrary,
  hasAiAccess,
  targets,
  personalPlanId,
  waterGoalMl,
  nutritionPlan,
  goal,
  initialWaterMl,
  initialCardios,
  initialCardioCompletions,
  heightCm,
  intakeWeightKg,
  weightHistory,
  weightLog,
  progressPhotoSets,
  initialCurrentUrls,
  habits,
  suggestedHabits,
}: {
  clientId: string;
  schedule: ClientSchedule;
  accountCreatedAt?: string | null;
  gender?: WorkoutProps["gender"];
  initialWorkout: WorkoutProps["initialWorkout"];
  initialWorkouts: WorkoutProps["initialWorkouts"];
  initialWorkoutCompleted: WorkoutProps["initialWorkoutCompleted"];
  initialWorkoutResults: WorkoutProps["initialWorkoutResults"];
  initialLog: OverviewProps["initialLog"];
  initialDailyMeals: OverviewProps["initialDailyMeals"];
  mealLibrary: OverviewProps["mealLibrary"];
  hasAiAccess: boolean;
  targets: OverviewProps["targets"];
  personalPlanId?: OverviewProps["personalPlanId"];
  waterGoalMl: number;
  nutritionPlan: OverviewProps["nutritionPlan"];
  goal?: OverviewProps["goal"];
  initialWaterMl: WaterProps["initialWaterMl"];
  initialCardios: CardioProps["initialScheduled"];
  initialCardioCompletions: CardioProps["initialCompletions"];
  heightCm?: BodyProps["heightCm"];
  intakeWeightKg?: BodyProps["intakeWeightKg"];
  weightHistory: BodyProps["initialHistory"];
  weightLog: BodyProps["initialLog"];
  progressPhotoSets: PhotosProps["initialSets"];
  initialCurrentUrls: PhotosProps["initialCurrentUrls"];
  habits: HabitsProps["initialHabits"];
  suggestedHabits: HabitsProps["suggestedHabits"];
}) {
  return (
    <DashboardHomeShell
      clientId={clientId}
      schedule={schedule}
      accountCreatedAt={accountCreatedAt}
    >
      {() => (
        <>
          <DashboardWorkoutCard
            clientId={clientId}
            gender={gender}
            initialWorkout={initialWorkout}
            initialWorkouts={initialWorkouts}
            initialWorkoutCompleted={initialWorkoutCompleted}
            initialWorkoutResults={initialWorkoutResults}
            variant="hero"
            schedule={schedule}
          />

          <DashboardOverview
            clientId={clientId}
            initialLog={initialLog}
            initialDailyMeals={initialDailyMeals}
            mealLibrary={mealLibrary}
            hasAiAccess={hasAiAccess}
            targets={targets}
            personalPlanId={personalPlanId}
            initialWaterGoalMl={waterGoalMl}
            nutritionPlan={nutritionPlan}
            goal={goal}
            variant="compact"
            schedule={schedule}
          />

          <div className="grid grid-cols-2 items-stretch gap-3">
            <DashboardWaterCard
              clientId={clientId}
              initialWaterMl={initialWaterMl}
              waterGoalMl={waterGoalMl}
              variant="compact"
            />

            <DashboardCardioCard
              clientId={clientId}
              initialScheduled={initialCardios}
              initialCompletions={initialCardioCompletions}
              variant="compact"
              schedule={schedule}
            />
          </div>

          <BodyMetricsSection
            clientId={clientId}
            heightCm={heightCm}
            intakeWeightKg={intakeWeightKg}
            accountCreatedAt={accountCreatedAt}
            initialHistory={weightHistory}
            initialLog={weightLog}
          />

          <ProgressPhotosCard
            clientId={clientId}
            initialSets={progressPhotoSets}
            initialCurrentUrls={initialCurrentUrls}
          />

          <HabitsTracker
            clientId={clientId}
            initialHabits={habits}
            suggestedHabits={suggestedHabits}
          />
        </>
      )}
    </DashboardHomeShell>
  );
}
