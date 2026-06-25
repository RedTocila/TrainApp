import { redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { CheckoutClient } from "@/components/checkout-client";
import { PageTransition } from "@/components/page-transition";
import {
  parseCheckoutCurrency,
  parseCheckoutLocale,
} from "@/lib/checkout-i18n";
import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlan } from "@/lib/subscription-plans";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    interval?: string;
    currency?: string;
    locale?: string;
  }>;
}) {
  await requireClient();
  const params = await searchParams;
  const planId = params.plan as SubscriptionPlanId | undefined;
  const interval = params.interval as BillingInterval | undefined;
  const currency = parseCheckoutCurrency(params.currency);
  const locale = parseCheckoutLocale(params.locale);

  if (!planId || !interval || !getPlan(planId)) {
    redirect("/dashboard/pricing");
  }
  if (interval !== "monthly" && interval !== "annual") {
    redirect("/dashboard/pricing");
  }

  return (
    <PageTransition>
      <CheckoutClient
        planId={planId}
        interval={interval}
        currency={currency}
        locale={locale}
      />
    </PageTransition>
  );
}
