import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getWorkoutPlans } from "@/lib/actions/plans";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function WorkoutsPage() {
  await requireAdmin();
  const plans = await getWorkoutPlans();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Workout Plans</h1>
            <p className="text-muted-foreground">Create and manage workout templates</p>
          </div>
          <Link href="/admin/workouts/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Plan
            </Button>
          </Link>
        </div>

        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No workout plans yet. Create your first one!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <Link href={`/admin/workouts/${plan.id}/edit`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                </CardHeader>
                {plan.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
