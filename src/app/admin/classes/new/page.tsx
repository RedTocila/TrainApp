import { requireAdmin } from "@/lib/actions/auth";
import { createClass } from "@/lib/actions/classes";
import { AdminBackLink } from "@/components/admin-back-link";
import { AdminClassForm } from "@/components/admin-class-form";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewClassPage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <AdminBackLink href="/admin/classes" label="Back to classes" />
        <div>
          <h1 className="text-2xl font-black">New live class</h1>
          <p className="text-sm text-muted-foreground">
            Add a YouTube Live URL for the stream. After class, paste the same or updated YouTube
            link as the replay so clients can watch later.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Class details</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminClassForm action={createClass} submitLabel="Create class" />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
