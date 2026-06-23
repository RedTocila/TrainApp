import { requireAdmin } from "@/lib/actions/auth";
import { NutritionBuilder } from "@/components/nutrition-builder";
import { PageTransition } from "@/components/page-transition";

export default async function NewNutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; request?: string }>;
}) {
  await requireAdmin();
  const { client, request } = await searchParams;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Create Nutrition Plan</h1>
          {client && (
            <p className="text-muted-foreground">Building for client assignment</p>
          )}
        </div>
        <NutritionBuilder clientId={client} requestId={request} />
      </div>
    </PageTransition>
  );
}
