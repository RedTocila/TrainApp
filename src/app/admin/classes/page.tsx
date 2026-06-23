import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllClasses } from "@/lib/actions/classes";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteClassButton } from "@/components/delete-class-button";
import { getClassStatus } from "@/lib/class-utils";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default async function AdminClassesPage() {
  await requireAdmin();
  const classes = await getAllClasses();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Live Classes</h1>
            <p className="text-muted-foreground">
              Schedule Zoom/Meet sessions and add YouTube replays for TrainApp AI clients
            </p>
          </div>
          <Link href="/admin/classes/new" className="shrink-0">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New class
            </Button>
          </Link>
        </div>

        {classes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No classes scheduled yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {classes.map((fitnessClass) => {
              const status = getClassStatus(fitnessClass);
              return (
                <Card key={fitnessClass.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base">{fitnessClass.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(fitnessClass.scheduled_at), "MMM d, yyyy · h:mm a")} ·{" "}
                        {fitnessClass.duration_minutes} min
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="secondary">{fitnessClass.category}</Badge>
                        <Badge variant="outline">{status}</Badge>
                        {!fitnessClass.meeting_url && (
                          <Badge variant="outline" className="text-amber-500">
                            No meeting link
                          </Badge>
                        )}
                        {!fitnessClass.replay_url && status === "ended" && (
                          <Badge variant="outline" className="text-amber-500">
                            Needs replay
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/admin/classes/${fitnessClass.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Badge variant={fitnessClass.published ? "success" : "secondary"}>
                        {fitnessClass.published ? "Published" : "Draft"}
                      </Badge>
                      <DeleteClassButton classId={fitnessClass.id} />
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
