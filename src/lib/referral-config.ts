import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlanPrice } from "@/lib/subscription-plans";

/** Referrals count only when the referred user buys monthly AI (€20/mo). */
export const REFERRAL_QUALIFYING_PLAN: SubscriptionPlanId = "ai";
export const REFERRAL_QUALIFYING_INTERVAL: BillingInterval = "monthly";

/** €5 credit per successful paying referral. */
export const REFERRAL_CREDIT_CENTS = 500;

/** Monthly AI subscription price in cents. */
export const MONTHLY_SUBSCRIPTION_CENTS = 2000;

/** Bonus premium days for users who join via referral after first payment. */
export const NEW_USER_REFERRAL_BONUS_DAYS = 7;

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

export function getReferralQualifyingPriceLabel(): string {
  const price = getPlanPrice(
    REFERRAL_QUALIFYING_PLAN,
    REFERRAL_QUALIFYING_INTERVAL
  );
  return `${price.label}/mo`;
}

export const REFERRAL_CHECKOUT_PATH = `/dashboard/checkout?plan=${REFERRAL_QUALIFYING_PLAN}&interval=${REFERRAL_QUALIFYING_INTERVAL}`;
