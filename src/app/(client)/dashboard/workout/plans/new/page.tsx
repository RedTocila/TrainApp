import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutsWithSchedules,
  getWeekPlanBuilderOptions,
} from "@/lib/actions/user-workouts";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { WeekPlanBuilderClient } from "@/components/week-plan-builder-client";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function NewWeekPlanPage() {
  await requireClient();
  const [options, libraryWorkouts, profile] = await Promise.all([
    getWeekPlanBuilderOptions(),
    getPersonalWorkoutsWithSchedules(),
    getSubscriptionProfile(),
  ]);

  return (
    <PageTransition>
      <div className="w-full space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/workout/plans">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
              <ArrowLeft className="h-4 w-4" />
              Plans
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">Create plan</h1>
        </div>
        <WeekPlanBuilderClient
          libraryWorkouts={libraryWorkouts}
          warmups={options.warmups}
          stretches={options.stretches}
          gender={profile?.gender}
        />
      </div>
    </PageTransition>
  );
}
