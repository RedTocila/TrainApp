import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { getClientActivityFeed } from "@/lib/actions/client-activity";
import { getAdminClientCalendarData } from "@/lib/actions/admin-client-calendar";
import { getAdminClientProgressPhotoGallery } from "@/lib/actions/admin-progress-photos";
import { AdminClientProgressPhotos } from "@/components/admin-client-progress-photos";
import { createClient } from "@/lib/supabase/server";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone } from "lucide-react";
import { ClientActivityFeed } from "@/components/client-activity-feed";
import { AdminClientCalendar } from "@/components/admin-client-calendar";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [workout, nutrition, activity, calendarData, progressPhotos] =
    await Promise.all([
      getClientWorkoutAssignment(id),
      getClientNutritionAssignment(id),
      getClientActivityFeed(id, 50),
      getAdminClientCalendarData(id),
      getAdminClientProgressPhotoGallery(id),
    ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-black">{client.full_name}</h1>
          <p className="text-muted-foreground">Client profile & activity</p>
          {client.phone && (
            <a
              href={`sms:${client.phone.replace(/\s/g, "")}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              {client.phone}
            </a>
          )}
        </div>

        {calendarData && (
          <AdminClientCalendar
            schedule={calendarData.schedule}
            enrichment={calendarData.enrichment}
          />
        )}

        <AdminClientProgressPhotos months={progressPhotos} />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workout Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {workout?.workout_plans ? (
                <p className="font-medium">{workout.workout_plans.title}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No active plan</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nutrition Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {nutrition?.nutrition_plans ? (
                <p className="font-medium">{nutrition.nutrition_plans.title}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No active plan</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientActivityFeed items={activity} />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
