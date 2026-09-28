import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getClassById, updateClass } from "@/lib/actions/classes";
import { AdminBackLink } from "@/components/admin-back-link";
import { AdminClassForm } from "@/components/admin-class-form";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const fitnessClass = await getClassById(id);
  if (!fitnessClass) notFound();

  const updateWithId = updateClass.bind(null, id);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <AdminBackLink href="/admin/classes" label="Back to classes" />
        <div>
          <h1 className="text-2xl font-black">Edit class</h1>
          <p className="text-sm text-muted-foreground">
            Add or update the YouTube replay link after the live session ends.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{fitnessClass.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminClassForm
              action={updateWithId}
              fitnessClass={fitnessClass}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
