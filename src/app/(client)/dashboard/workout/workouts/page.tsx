import Link from "next/link";
import { ArrowLeft, List } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getPersonalWorkoutsWithSchedules } from "@/lib/actions/user-workouts";
import { AllWorkoutsPage } from "@/components/all-workouts-page";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function AllWorkoutsRoute() {
  await requireClient();
  const workouts = await getPersonalWorkoutsWithSchedules();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/dashboard/workout">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
            <ArrowLeft className="h-4 w-4" />
            Workouts
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <List className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black">All workouts</h1>
            <p className="text-xs text-muted-foreground">Every program</p>
          </div>
        </div>
        <AllWorkoutsPage workouts={workouts} />
      </div>
    </PageTransition>
  );
}
