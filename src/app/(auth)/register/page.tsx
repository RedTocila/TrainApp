import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { RegisterForm } from "@/components/register-form";
import { getPublicActiveSubscriptionOffers } from "@/lib/actions/admin-offers";

export default async function RegisterPage() {
  noStore();
  // Resolve offers on the server. Passing a Promise prop from a "use server"
  // action breaks client navigations (Login → Register) and crashes GlobalError.
  const initialOffers = await getPublicActiveSubscriptionOffers().catch(() => []);
  return (
    <Suspense
      fallback={
        <div className="h-80 w-full animate-pulse rounded-xl bg-muted/40" aria-hidden />
      }
    >
      <RegisterForm initialOffers={initialOffers} />
    </Suspense>
  );
}
