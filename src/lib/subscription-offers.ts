import type { BillingInterval, SoldSubscriptionPlanId } from "@/lib/subscription-plans";

export type OfferInterval = BillingInterval | "all";

export interface SubscriptionOffer {
  id: string;
  name: string;
  plan_id: SoldSubscriptionPlanId;
  billing_interval: OfferInterval;
  percent_off: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  badge_text: string | null;
  image_url?: string | null;
}

function isWithinWindow(now: Date, startsAt: string | null, endsAt: string | null) {
  const afterStart = !startsAt || now >= new Date(startsAt);
  const beforeEnd = !endsAt || now <= new Date(endsAt);
  return afterStart && beforeEnd;
}

export function isOfferApplicable(
  offer: SubscriptionOffer,
  planId: SoldSubscriptionPlanId,
  interval: BillingInterval,
  now: Date = new Date()
) {
  if (!offer.active) return false;
  if (offer.plan_id !== planId) return false;
  if (offer.billing_interval !== "all" && offer.billing_interval !== interval) return false;
  return isWithinWindow(now, offer.starts_at, offer.ends_at);
}

export function pickBestOffer(
  offers: SubscriptionOffer[],
  planId: SoldSubscriptionPlanId,
  interval: BillingInterval,
  now: Date = new Date()
): SubscriptionOffer | null {
  const applicable = offers.filter((offer) =>
    isOfferApplicable(offer, planId, interval, now)
  );
  if (applicable.length === 0) return null;
  return applicable.sort((a, b) => b.percent_off - a.percent_off)[0] ?? null;
}

export function applyOfferDiscount(amountCents: number, offer: SubscriptionOffer | null): number {
  if (!offer) return amountCents;
  const percent = Math.max(0, Math.min(100, offer.percent_off));
  const discounted = Math.round(amountCents * (1 - percent / 100));
  return Math.max(0, discounted);
}

export function getOfferEndsLabel(offer: SubscriptionOffer | null, locale = "en"): string | null {
  if (!offer?.ends_at) return null;
  const endDate = new Date(offer.ends_at);
  if (Number.isNaN(endDate.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(endDate);
}
