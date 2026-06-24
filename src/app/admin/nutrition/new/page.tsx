import { requireAdmin } from "@/lib/actions/auth";
import { getClientIntakeInfo } from "@/lib/actions/client-intake";
import { createClient } from "@/lib/supabase/server";
import { NutritionBuilder } from "@/components/nutrition-builder";
import { AdminNutritionPdfUpload } from "@/components/admin-nutrition-pdf-upload";
import { PageTransition } from "@/components/page-transition";

export default async function NewNutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; request?: string }>;
}) {
  await requireAdmin();
  const { client, request: requestId } = await searchParams;

  if (client) {
    const supabase = await createClient();
    const [clientIntake, planRequest] = await Promise.all([
      getClientIntakeInfo(client),
      requestId
        ? supabase.from("plan_requests").select("*").eq("id", requestId).single()
        : Promise.resolve({ data: null }),
    ]);

    if (!requestId) {
      return (
        <PageTransition>
          <div className="mx-auto max-w-3xl space-y-6">
            <div>
              <h1 className="text-2xl font-black">Send Nutrition Plan</h1>
              <p className="text-muted-foreground">
                Open a client request to upload and send a PDF plan.
              </p>
            </div>
          </div>
        </PageTransition>
      );
    }

    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-2xl font-black">Send Nutrition Plan</h1>
            <p className="text-muted-foreground">
              Upload a PDF and send it to your client
            </p>
          </div>
          <AdminNutritionPdfUpload
            clientId={client}
            requestId={requestId}
            clientIntake={clientIntake}
            requestPreferences={planRequest.data?.preferences ?? planRequest.data?.notes}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Create Nutrition Plan</h1>
          <p className="text-muted-foreground">Template plan (no client assignment)</p>
        </div>
        <NutritionBuilder />
      </div>
    </PageTransition>
  );
}
