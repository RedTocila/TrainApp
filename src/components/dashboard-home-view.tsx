"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DashboardHomeShell } from "@/components/dashboard-home-shell";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { DashboardOverview } from "@/components/dashboard-overview";
import { DashboardWaterCard } from "@/components/dashboard-water-card";
import { DashboardCardioCard } from "@/components/dashboard-cardio-card";
import { ClientIntakeForm } from "@/components/client-intake-form";
import { DashboardScheduleProvider } from "@/components/dashboard-schedule-context";
import { DashboardTodayCacheSeed } from "@/components/dashboard-today-cache-seed";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { Profile } from "@/lib/types";
import type { ComponentProps } from "react";

type WorkoutProps = ComponentProps<typeof DashboardWorkoutCard>;
type OverviewProps = ComponentProps<typeof DashboardOverview>;
type WaterProps = ComponentProps<typeof DashboardWaterCard>;
type CardioProps = ComponentProps<typeof DashboardCardioCard>;

/**
 * Client boundary for the home dashboard — today's cards paint first;
 * below-fold content streams in via `children`.
 */
export function DashboardHomeView({
  clientId,
  seedDateKey,
  schedule: initialSchedule,
  gender,
  initialWorkout,
  initialWorkouts,
  initialWorkoutCompleted,
  initialWorkoutResults,
  initialLog,
  initialDailyMeals,
  hasAiAccess,
  targets,
  personalPlanId,
  waterGoalMl,
  nutritionPlan,
  goal,
  initialWaterMl,
  initialCardios,
  initialCardioCompletions,
  profile,
  children,
}: {
  clientId: string;
  seedDateKey: string;
  schedule: ClientSchedule;
  gender?: WorkoutProps["gender"];
  initialWorkout: WorkoutProps["initialWorkout"];
  initialWorkouts: WorkoutProps["initialWorkouts"];
  initialWorkoutCompleted: WorkoutProps["initialWorkoutCompleted"];
  initialWorkoutResults: WorkoutProps["initialWorkoutResults"];
  initialLog: OverviewProps["initialLog"];
  initialDailyMeals: OverviewProps["initialDailyMeals"];
  hasAiAccess: boolean;
  targets: OverviewProps["targets"];
  personalPlanId?: OverviewProps["personalPlanId"];
  waterGoalMl: number;
  nutritionPlan: OverviewProps["nutritionPlan"];
  goal?: OverviewProps["goal"];
  initialWaterMl: WaterProps["initialWaterMl"];
  initialCardios: CardioProps["initialScheduled"];
  initialCardioCompletions: CardioProps["initialCompletions"];
  profile: Profile;
  children?: ReactNode;
}) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const mergeSchedule = useCallback((patch: Partial<ClientSchedule>) => {
    setSchedule((current) => ({ ...current, ...patch }));
  }, []);

  return (
    <DashboardScheduleProvider mergeSchedule={mergeSchedule}>
      <DashboardTodayCacheSeed
        clientId={clientId}
        dateKey={seedDateKey}
        workout={{
          workouts: initialWorkouts ?? [],
          completedByTaskId: Object.fromEntries(
            (initialWorkouts ?? []).map((workout) => [
              workout.taskId,
              initialWorkoutCompleted ?? false,
            ])
          ),
          skippedByTaskId: {},
          sessionIdByTaskId: {},
          allCompleted: initialWorkoutCompleted ?? false,
          results: initialWorkoutResults ?? null,
        }}
        overview={{
          log: initialLog,
          dailyMeals: initialDailyMeals,
          nutritionPlan: nutritionPlan ?? null,
        }}
      />
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
          mealLibrary={[]}
          hasAiAccess={hasAiAccess}
          targets={targets}
          personalPlanId={personalPlanId}
          initialWaterGoalMl={waterGoalMl}
          nutritionPlan={nutritionPlan}
          goal={goal}
          variant="compact"
          schedule={schedule}
        />

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

          {children}
        </div>

        <ClientIntakeForm profile={profile} />
      </DashboardHomeShell>
    </DashboardScheduleProvider>
  );
}
