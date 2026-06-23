import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getClientRequests } from "@/lib/actions/requests";
import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { createClient } from "@/lib/supabase/server";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

  const [requests, workout, nutrition] = await Promise.all([
    getClientRequests(id),
    getClientWorkoutAssignment(id),
    getClientNutritionAssignment(id),
  ]);

  const activeRequest = requestId
    ? requests.find((r) => r.id === requestId)
    : requests.find((r) => r.status !== "completed");

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-black">{client.full_name}</h1>
          <p className="text-muted-foreground">Client profile</p>
        </div>

        {activeRequest && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Active Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Badge className="capitalize">{activeRequest.type}</Badge>
                <Badge variant="warning">{activeRequest.status}</Badge>
              </div>
              {activeRequest.notes && (
                <p className="text-sm text-muted-foreground">{activeRequest.notes}</p>
              )}
              <Link
                href={
                  activeRequest.type === "workout"
                    ? `/admin/workouts/new?client=${id}&request=${activeRequest.id}`
                    : `/admin/nutrition/new?client=${id}&request=${activeRequest.id}`
                }
              >
                <Button size="sm">Build {activeRequest.type} Plan</Button>
              </Link>
            </CardContent>
          </Card>
        )}

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
            <CardTitle className="text-base">Request History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{r.type} plan</span>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
