import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/workout">
            <Button variant="ghost" size="sm" className="-ml-2 w-fit">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to folders
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">All Workouts</h1>
            <p className="text-sm text-muted-foreground">
              Every workout program you&apos;ve created, across all folders
            </p>
          </div>
        </div>

        <AllWorkoutsPage workouts={workouts} />
      </div>
    </PageTransition>
  );
}
