import { PageTransition } from "@/components/page-transition";
import { AdminOffersManager } from "@/components/admin-offers-manager";
import { getAdminSubscriptionOffers } from "@/lib/actions/admin-offers";

export default async function AdminOffersPage() {
  const { offers, warning } = await getAdminSubscriptionOffers();

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Package Offers</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Create time-limited discounts for subscription packages.
          </p>
        </div>
        <AdminOffersManager offers={offers} warning={warning} />
      </div>
    </PageTransition>
  );
}
