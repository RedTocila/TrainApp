import { redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { getPreferredLocale } from "@/lib/actions/profile";
import { CheckoutClient } from "@/components/checkout-client";
import { PageTransition } from "@/components/page-transition";
import { parseCheckoutCurrency } from "@/lib/checkout-i18n";
import { getCachedAllPerEur } from "@/lib/exchange-rates";
import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlan, getPlanPrice } from "@/lib/subscription-plans";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    interval?: string;
    currency?: string;
  }>;
}) {
  await requireClient();
  const params = await searchParams;
  const planId = params.plan as SubscriptionPlanId | undefined;
  const interval = params.interval as BillingInterval | undefined;
  const currency = parseCheckoutCurrency(params.currency);
  const locale = await getPreferredLocale();

  if (!planId || !interval || !getPlan(planId)) {
    redirect("/dashboard/pricing");
  }
  if (interval !== "monthly" && interval !== "annual") {
    redirect("/dashboard/pricing");
  }

  const allPerEur = await getCachedAllPerEur();
  const displayPrice = getPlanPrice(planId, interval, currency, allPerEur);

  return (
    <PageTransition>
      <CheckoutClient
        planId={planId}
        interval={interval}
        currency={currency}
        locale={locale}
        displayPrice={displayPrice}
      />
    </PageTransition>
  );
}
