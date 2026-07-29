import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";
import { getPublicActiveSubscriptionOffers } from "@/lib/actions/admin-offers";

export default async function RegisterPage() {
  const offers = await getPublicActiveSubscriptionOffers();
  return (
    <Suspense fallback={null}>
      <RegisterForm initialOffers={offers} />
    </Suspense>
  );
}
