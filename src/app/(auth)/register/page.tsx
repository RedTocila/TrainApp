import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { RegisterForm } from "@/components/register-form";
import { getPublicActiveSubscriptionOffers } from "@/lib/actions/admin-offers";

export default function RegisterPage() {
  noStore();
  // Offers only matter on the package step — stream them instead of blocking first paint.
  const offersPromise = getPublicActiveSubscriptionOffers();
  return (
    <Suspense fallback={null}>
      <RegisterForm offersPromise={offersPromise} />
    </Suspense>
  );
}
