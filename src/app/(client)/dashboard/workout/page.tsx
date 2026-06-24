import { requireClient } from "@/lib/actions/auth";
import { getPersonalWorkoutsWithSchedules } from "@/lib/actions/user-workouts";
import { getClientPlanRequests } from "@/lib/actions/custom-plans";
import { AllWorkoutsPage } from "@/components/all-workouts-page";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";
import Link from "next/link";
import { Dumbbell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function WorkoutPage() {
  const profile = await requireClient();

  const [workouts, planRequests] = await Promise.all([
    getPersonalWorkoutsWithSchedules(),
    getClientPlanRequests(profile.id),
  ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-3xl space-y-5">
        <WorkoutSectionTabs />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black">Workouts</h1>
              <p className="text-xs text-muted-foreground">{workouts.length} programs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/ai/plans/workout">
              <Button size="sm" variant="secondary">
                <Sparkles className="mr-1.5 h-4 w-4" />
                AI plan
              </Button>
            </Link>
            <Link href="/dashboard/workout/new">
              <Button size="sm">New</Button>
            </Link>
          </div>
        </div>

        {planRequests.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-sm">
              You have {planRequests.length} pending plan request
              {planRequests.length === 1 ? "" : "s"}.
            </CardContent>
          </Card>
        )}

        <AllWorkoutsPage workouts={workouts} />
      </div>
    </PageTransition>
  );
}
