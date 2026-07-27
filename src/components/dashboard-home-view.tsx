"use client";

import { DashboardHomeShell } from "@/components/dashboard-home-shell";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { DashboardOverview } from "@/components/dashboard-overview";
import { DashboardWaterCard } from "@/components/dashboard-water-card";
import { DashboardCardioCard } from "@/components/dashboard-cardio-card";
import { BodyMetricsSection } from "@/components/body-metrics-section";
import { ProgressPhotosCard } from "@/components/progress-photos-card";
import { HabitsTracker } from "@/components/habits-tracker";
import { ClientIntakeForm } from "@/components/client-intake-form";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { Profile } from "@/lib/types";
import type { ComponentProps } from "react";

type WorkoutProps = ComponentProps<typeof DashboardWorkoutCard>;
type OverviewProps = ComponentProps<typeof DashboardOverview>;
type WaterProps = ComponentProps<typeof DashboardWaterCard>;
type CardioProps = ComponentProps<typeof DashboardCardioCard>;
type BodyProps = ComponentProps<typeof BodyMetricsSection>;
type PhotosProps = ComponentProps<typeof ProgressPhotosCard>;
type HabitsProps = ComponentProps<typeof HabitsTracker>;

/**
 * Client boundary for the home dashboard — one day tree only
 * (calendar selects the day; no swipe carousel).
 */
export function DashboardHomeView({
  clientId,
  seedDateKey,
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
  profile,
}: {
  clientId: string;
  seedDateKey: string;
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
  profile: Profile;
}) {
  return (
    <DashboardHomeShell clientId={clientId} schedule={schedule}>
      <DashboardWorkoutCard
        clientId={clientId}
        seedDateKey={seedDateKey}
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
        seedDateKey={seedDateKey}
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

      {/* Flex (not grid+h-full): iPad Safari collapses percentage grid rows and BMI overlaps the pair. */}
      <div className="flex w-full shrink-0 flex-col gap-3 sm:gap-4 md:gap-5">
        <div className="flex w-full items-stretch gap-3 sm:gap-3.5 md:gap-4">
          <div className="w-1/2 min-w-0">
            <DashboardWaterCard
              clientId={clientId}
              initialWaterMl={initialWaterMl}
              waterGoalMl={waterGoalMl}
              variant="compact"
            />
          </div>
          <div className="w-1/2 min-w-0">
            <DashboardCardioCard
              clientId={clientId}
              seedDateKey={seedDateKey}
              initialScheduled={initialCardios}
              initialCompletions={initialCardioCompletions}
              variant="compact"
              schedule={schedule}
            />
          </div>
        </div>

        <BodyMetricsSection
          clientId={clientId}
          heightCm={heightCm}
          intakeWeightKg={intakeWeightKg}
          accountCreatedAt={accountCreatedAt}
          initialHistory={weightHistory}
          initialLog={weightLog}
        />
      </div>

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

      <ClientIntakeForm profile={profile} />
    </DashboardHomeShell>
  );
}
