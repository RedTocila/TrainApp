import { format } from "date-fns";
import Link from "next/link";
import { Dumbbell, Apple } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getClientRequests } from "@/lib/actions/requests";
import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { getDailyLog } from "@/lib/actions/logs";
import { formatDateKey } from "@/lib/utils";
import { ApplyPlanCards } from "@/components/apply-plan-cards";
import { DailyTracker } from "@/components/daily-tracker";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function DashboardPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);

  const [requests, workoutAssignment, nutritionAssignment, dailyLog] =
    await Promise.all([
      getClientRequests(profile.id),
      getClientWorkoutAssignment(profile.id),
      getClientNutritionAssignment(profile.id),
      getDailyLog(profile.id, dateKey),
    ]);

  const needsWorkout = !workoutAssignment;
  const needsDiet = !nutritionAssignment;
  const showApply =
    needsWorkout || needsDiet;

  const nutritionPlan = nutritionAssignment?.nutrition_plans;
  const workoutPlan = workoutAssignment?.workout_plans;
  const todayDayIndex = today.getDay() % (workoutPlan?.workout_days?.length || 1);
  const todayWorkout = workoutPlan?.workout_days?.[todayDayIndex];

  const targets = {
    calories: nutritionPlan?.target_calories ?? 2000,
    protein: nutritionPlan?.target_protein ?? 150,
    carbs: nutritionPlan?.target_carbs ?? 200,
    fat: nutritionPlan?.target_fat ?? 65,
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            {format(today, "EEEE, MMMM d")}
          </h1>
          <p className="text-muted-foreground">Your daily overview</p>
        </div>

        {showApply && (
          <ApplyPlanCards
            requests={requests.filter((r) => r.status !== "completed")}
            needsWorkout={needsWorkout}
            needsDiet={needsDiet}
          />
        )}

        <StaggerContainer>
          <div className="grid gap-4 md:grid-cols-2">
            <StaggerItem>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    Today&apos;s Workout
                  </CardTitle>
                  <Link href="/dashboard/workout">
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {todayWorkout ? (
                    <div>
                      <p className="font-semibold">{todayWorkout.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {todayWorkout.exercises?.length ?? 0} exercises
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {todayWorkout.exercises?.slice(0, 3).map((ex: { id: string; name: string }) => (
                          <Badge key={ex.id} variant="secondary">{ex.name}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No workout assigned yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5 text-primary" />
                    Nutrition Today
                  </CardTitle>
                  <Link href="/dashboard/nutrition">
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {nutritionPlan ? (
                    <div className="space-y-2">
                      <p className="font-semibold">{nutritionPlan.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Target: {nutritionPlan.target_calories} cal · {nutritionPlan.target_protein}g protein
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No nutrition plan assigned yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          </div>
        </StaggerContainer>

        <DashboardOverview
          clientId={profile.id}
          initialLog={dailyLog}
          targets={targets}
        />
      </div>
    </PageTransition>
  );
}
