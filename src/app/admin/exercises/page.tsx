import { requireAdmin } from "@/lib/actions/auth";
import { getAdminExercises } from "@/lib/actions/admin-exercises";
import { AdminExercisesClient } from "@/components/admin-exercises-client";
import { PageTransition } from "@/components/page-transition";

export const dynamic = "force-dynamic";

export default async function AdminExercisesPage() {
  await requireAdmin();
  const { exercises, categories } = await getAdminExercises();

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Exercise Library</h1>
          <p className="text-muted-foreground">
            Connect each exercise with a YouTube video so clients can see the correct form.
          </p>
        </div>
        <AdminExercisesClient exercises={exercises} categories={categories} />
      </div>
    </PageTransition>
  );
}
