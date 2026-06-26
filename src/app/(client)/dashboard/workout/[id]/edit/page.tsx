import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutPlanWithDetails,
  getPlanScheduleForEdit,
  getWorkoutFoldersForMove,
} from "@/lib/actions/user-workouts";
import { EditWorkoutClient } from "@/components/edit-workout-client";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const [{ plan, days }, initialSchedule, folders] = await Promise.all([
    getPersonalWorkoutPlanWithDetails(id),
    getPlanScheduleForEdit(id),
    getWorkoutFoldersForMove(),
  ]);

  if (!plan) notFound();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/workout">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">Edit Workout</h1>
            <p className="text-sm text-muted-foreground">{plan.title}</p>
          </div>
        </div>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-secondary/40" />}>
          <EditWorkoutClient
            plan={plan}
            days={days}
            initialSchedule={initialSchedule}
            folders={folders}
          />
        </Suspense>
      </div>
    </PageTransition>
  );
}
