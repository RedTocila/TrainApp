import { requireAdmin } from "@/lib/actions/auth";
import { getPendingRequests } from "@/lib/actions/requests";
import { markAllReadForm } from "@/lib/actions/admin";
import { PlanRequestCard } from "@/components/plan-request-card";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function RequestsPage() {
  await requireAdmin();
  const requests = await getPendingRequests();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Plan Requests</h1>
            <p className="text-muted-foreground">
              Review and build plans for your clients
            </p>
          </div>
          <form action={markAllReadForm}>
            <Button type="submit" variant="outline" size="sm">
              Mark all read
            </Button>
          </form>
        </div>

        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No pending requests
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <PlanRequestCard key={req.id} request={req} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
