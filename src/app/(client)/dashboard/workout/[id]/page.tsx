import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getPersonalWorkoutPlanWithDetails } from "@/lib/actions/user-workouts";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { WorkoutPlanPreviewClient } from "@/components/workout-plan-preview-client";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

async function getNextScheduleSummary(planId: string, userId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .gte("scheduled_date", today)
    .order("scheduled_date");

  if (!data?.length) return null;

  const nextLabel = new Date(data[0].scheduled_date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric" }
  );
  return data.length === 1
    ? `Next: ${nextLabel}`
    : `Next: ${nextLabel} · ${data.length} sessions`;
}

export default async function WorkoutPlanPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const [{ plan, days }, profile, scheduleSummary] = await Promise.all([
    getPersonalWorkoutPlanWithDetails(id),
    getSubscriptionProfile(),
    getNextScheduleSummary(id, user.id),
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
            <h1 className="text-2xl font-black">{plan.title}</h1>
            <p className="text-sm text-muted-foreground">Workout preview</p>
          </div>
        </div>
        <WorkoutPlanPreviewClient
          plan={plan}
          days={days}
          gender={profile?.gender}
          scheduleSummary={scheduleSummary}
        />
      </div>
    </PageTransition>
  );
}
