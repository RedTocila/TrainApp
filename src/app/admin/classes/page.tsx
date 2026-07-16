import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllClasses } from "@/lib/actions/classes";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteClassButton } from "@/components/delete-class-button";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { getClassStatus } from "@/lib/class-utils";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default async function AdminClassesPage() {
  await requireAdmin();
  const classes = await getAllClasses();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Live Classes</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Schedule YouTube Live streams and add replay links for {PLATFORM_AI_NAME} clients
            </p>
          </div>
          <Link href="/admin/classes/new" className="w-full shrink-0 sm:w-auto">
            <Button className="w-full sm:w-auto">
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
                  <CardHeader className="space-y-3 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <CardTitle className="text-base leading-snug break-words">
                          {fitnessClass.title}
                        </CardTitle>
                        <p className="text-sm leading-relaxed text-muted-foreground">
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
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <Link
                          href={`/admin/classes/${fitnessClass.id}/edit`}
                          className="min-w-0 flex-1 sm:flex-none"
                        >
                          <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            Edit
                          </Button>
                        </Link>
                        <Badge variant={fitnessClass.published ? "success" : "secondary"}>
                          {fitnessClass.published ? "Published" : "Draft"}
                        </Badge>
                        <DeleteClassButton classId={fitnessClass.id} />
                      </div>
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
