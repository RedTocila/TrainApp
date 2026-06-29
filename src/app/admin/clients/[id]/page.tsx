import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getClientRequests } from "@/lib/actions/requests";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone } from "lucide-react";
import { ClientActivityFeed } from "@/components/client-activity-feed";
import { AdminClientCalendar } from "@/components/admin-client-calendar";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ request?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { request: requestId } = await searchParams;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [requests, workout, nutrition, activity, calendarData, progressPhotos] =
    await Promise.all([
      getClientRequests(id),
      getClientWorkoutAssignment(id),
      getClientNutritionAssignment(id),
      getClientActivityFeed(id, 50),
      getAdminClientCalendarData(id),
      getAdminClientProgressPhotoGallery(id),
    ]);

  const activeRequest = requestId
    ? requests.find((r) => r.id === requestId)
    : requests.find((r) =>
        ["pending", "awaiting_approval", "in_progress"].includes(r.status)
      );

  const needsBuild =
    activeRequest &&
    ["pending", "awaiting_approval", "in_progress"].includes(activeRequest.status);
  const sentToClient = activeRequest?.status === "delivered";

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

        {activeRequest && (
          <Card className={needsBuild ? "border-primary/30" : "border-green-500/30"}>
            <CardHeader>
              <CardTitle className="text-base">
                {needsBuild ? "Active Request" : sentToClient ? "Plan Sent" : "Request"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Badge className="capitalize">{activeRequest.type}</Badge>
                <Badge variant={sentToClient ? "default" : "warning"}>
                  {sentToClient
                    ? "Done — sent to client"
                    : activeRequest.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {activeRequest.notes && (
                <p className="text-sm text-muted-foreground">{activeRequest.notes}</p>
              )}
              {sentToClient && activeRequest.type === "diet" && (
                <p className="text-sm text-green-400">
                  Nutrition plan PDF sent. The client can view it from their Nutrition tab.
                </p>
              )}
              {sentToClient && activeRequest.type === "workout" && (
                <p className="text-sm text-green-400">
                  Plan delivered. Waiting for the client to click Implement it on their workout tab.
                </p>
              )}
              {needsBuild && (
                <Link
                  href={
                    activeRequest.type === "workout"
                      ? `/admin/workouts/new?client=${id}&request=${activeRequest.id}`
                      : `/admin/nutrition/new?client=${id}&request=${activeRequest.id}`
                  }
                >
                  <Button size="sm">
                    {activeRequest.type === "diet" ? "Upload PDF" : `Build ${activeRequest.type} plan`}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
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
                <p className="text-sm text-muted-foreground">Not assigned</p>
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
                <p className="text-sm text-muted-foreground">Not assigned</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{r.type} plan</span>
                  <Badge variant="outline">
                    {r.status === "delivered"
                      ? "Sent to client"
                      : r.status === "implemented" || r.status === "completed"
                        ? "Done"
                        : r.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
