"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { OfferBanner } from "@/components/offer-banner";
import { Button } from "@/components/ui/button";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getCompareAtLabel, getCurrencyPrice } from "@/lib/checkout-i18n";
import { getPublicActiveSubscriptionOffers } from "@/lib/actions/admin-offers";
import { getPricingFeatureIcon } from "@/lib/pricing-feature-icons";
import type { BillingInterval, SubscriptionPlan } from "@/lib/subscription-plans";
import type { SubscriptionOffer } from "@/lib/subscription-offers";
import { applyOfferDiscount, pickBestOffer } from "@/lib/subscription-offers";
import {
  formatAnnualSavingsLocalized,
  getLocalizedSubscriptionPlans,
  getPricingCardLabels,
} from "@/lib/subscription-plans-i18n";
import { cn } from "@/lib/utils";

const BILLING_INTERVALS = ["monthly", "annual"] as const;

function PlanRow({
  plan,
  interval,
  locale,
  selected,
  isCurrent,
  savings,
  perLabel,
  currentPlanLabel,
  seeDetailsLabel,
  hideDetailsLabel,
  includesFromLabel,
  onSelect,
  offer,
}: {
  plan: SubscriptionPlan;
  interval: BillingInterval;
  locale: string;
  selected: boolean;
  isCurrent: boolean;
  savings: string | null;
  perLabel: string;
  currentPlanLabel: string;
  seeDetailsLabel: string;
  hideDetailsLabel: string;
  includesFromLabel: (planName: string) => string;
  onSelect: () => void;
  offer: SubscriptionOffer | null;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  const discountedCents = applyOfferDiscount(tier.amountEurCents, offer);
  const price = getCurrencyPrice({ amountEurCents: discountedCents });
  const compareAt = offer
    ? getCompareAtLabel({
        amountEurCents: discountedCents,
        compareAtEurCents: tier.amountEurCents,
      })
    : getCompareAtLabel(tier);

  return (
    <div
      className={cn(
        "relative overflow-visible rounded-2xl border-2 transition-all",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_20px_-8px] shadow-primary/50"
          : "border-border/70 bg-secondary/30"
      )}
    >
      {offer ? <OfferBanner offer={offer} locale={locale} className="rounded-t-[14px]" /> : null}
      {selected && (
        <span
          className="absolute -right-2.5 -top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background"
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn("w-full p-4 text-left", !offer && "rounded-t-2xl")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black tracking-tight">{plan.name}</span>
              {plan.badge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {plan.badge}
                </span>
              )}
              {isCurrent && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {currentPlanLabel}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {plan.tagline}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              {compareAt && (
                <span className="text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/70">
                  {compareAt}
                </span>
              )}
              <p className="text-2xl font-black tracking-tight">{price.label}</p>
            </div>
            <p className="text-xs text-muted-foreground">/{perLabel}</p>
            {savings && (
              <p className="mt-0.5 text-[11px] font-semibold text-green-400">{savings}</p>
            )}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        aria-expanded={detailsOpen}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {detailsOpen ? hideDetailsLabel : seeDetailsLabel}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {detailsOpen && (
        <div className="space-y-3 px-4 pb-4">
          {plan.includesFrom && (
            <p className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {includesFromLabel(plan.includesFrom)}
            </p>
          )}
          <ul className="space-y-2">
            {plan.features.map((feature) => {
              const Icon = getPricingFeatureIcon(feature);
              return (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-3 w-3 text-primary" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PricingPlans({
  interval,
  onIntervalChange,
  checkoutBasePath = "/dashboard/checkout",
  currentPlan,
  subscribed,
}: {
  interval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
  checkoutBasePath?: string;
  currentPlan?: string | null;
  subscribed?: boolean;
}) {
  const locale = useLocale();
  const platform = usePlatformCopy();
  const pricing = platform.pricing;
  const plans = getLocalizedSubscriptionPlans(locale);
  const cardLabels = getPricingCardLabels(locale);

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (subscribed && currentPlan && plans.some((p) => p.id === currentPlan)) {
      return currentPlan;
    }
    return plans.find((p) => p.highlighted)?.id ?? plans[0].id;
  });
  const [offers, setOffers] = useState<SubscriptionOffer[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getPublicActiveSubscriptionOffers().then((rows) => {
      if (!cancelled) setOffers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedId) ?? plans[0];
  const offerByPlan = useMemo(
    () =>
      Object.fromEntries(
        plans.map((plan) => [
          plan.id,
          plan.id === "ai" || plan.id === "elite"
            ? pickBestOffer(offers, plan.id, interval)
            : null,
        ])
      ),
    [plans, offers, interval]
  );
  const selectedIsCurrent = Boolean(subscribed && currentPlan === selectedPlan.id);
  const checkoutHref = `${checkoutBasePath}?plan=${selectedPlan.id}&interval=${interval}`;
  const ctaLabel = selectedIsCurrent
    ? cardLabels.currentPlan
    : subscribed
      ? cardLabels.switchPlan
      : cardLabels.subscribe;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="flex justify-center">
        <SegmentedToggle
          value={interval}
          onChange={onIntervalChange}
          aria-label="Billing interval"
          className="w-full max-w-[280px] p-0.5"
          options={BILLING_INTERVALS.map((key) => ({
            value: key,
            label: key === "monthly" ? pricing.monthly : pricing.annual,
          }))}
        />
      </div>

      <div className="space-y-3 overflow-visible px-1 pt-1">
        {plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            interval={interval}
            locale={locale}
            selected={selectedId === plan.id}
            isCurrent={Boolean(subscribed && currentPlan === plan.id)}
            savings={
              interval === "annual"
                ? formatAnnualSavingsLocalized(plan.monthly, plan.annual, locale)
                : null
            }
            perLabel={interval === "monthly" ? cardLabels.perMonth : cardLabels.perYear}
            currentPlanLabel={cardLabels.currentPlan}
            seeDetailsLabel={pricing.seeDetails}
            hideDetailsLabel={pricing.hideDetails}
            includesFromLabel={cardLabels.includesFrom}
            onSelect={() => setSelectedId(plan.id)}
            offer={offerByPlan[plan.id] ?? null}
          />
        ))}
      </div>

      {selectedIsCurrent ? (
        <Button className="w-full" size="lg" variant="outline" disabled>
          {cardLabels.currentPlan}
        </Button>
      ) : (
        <Link href={checkoutHref} className="block">
          <Button className="w-full shadow-md shadow-primary/25" size="lg">
            {ctaLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
