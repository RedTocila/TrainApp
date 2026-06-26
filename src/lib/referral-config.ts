import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlanPrice } from "@/lib/subscription-plans";
import type { CheckoutCurrency } from "@/lib/checkout-i18n";

/** Referrals count only when the referred user buys monthly AI (€19/mo). */
export const REFERRAL_QUALIFYING_PLAN: SubscriptionPlanId = "ai";
export const REFERRAL_QUALIFYING_INTERVAL: BillingInterval = "monthly";

export function orderQualifiesReferral(order: {
  plan: string;
  billing_interval: string;
  order_kind?: string | null;
}): boolean {
  if ((order.order_kind ?? "subscription") !== "subscription") return false;
  return (
    order.plan === REFERRAL_QUALIFYING_PLAN &&
    order.billing_interval === REFERRAL_QUALIFYING_INTERVAL
  );
}

export function getReferralQualifyingPriceLabel(
  allPerEur: number,
  currency: CheckoutCurrency = "EUR"
): string {
  const price = getPlanPrice(
    REFERRAL_QUALIFYING_PLAN,
    REFERRAL_QUALIFYING_INTERVAL,
    currency,
    allPerEur
  );
  return `${price.label}/mo`;
}

export const REFERRAL_CHECKOUT_PATH = `/dashboard/checkout?plan=${REFERRAL_QUALIFYING_PLAN}&interval=${REFERRAL_QUALIFYING_INTERVAL}`;
