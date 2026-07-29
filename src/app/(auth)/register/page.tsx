import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { RegisterForm } from "@/components/register-form";
import { getPublicActiveSubscriptionOffers } from "@/lib/actions/admin-offers";

export default async function RegisterPage() {
  noStore();
  const offers = await getPublicActiveSubscriptionOffers();
  return (
    <Suspense fallback={null}>
      <RegisterForm initialOffers={offers} />
    </Suspense>
  );
}
