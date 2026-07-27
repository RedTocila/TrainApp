"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AddCardData, PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { PokPayAddCard } from "@/components/pokpay-add-card";
import { CheckoutLayout } from "@/components/checkout-layout";
import { usePlatformCopy } from "@/components/locale-provider";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { startAiProTrialWithCard } from "@/lib/actions/trial-subscription";
import { FREE_TRIAL_DAYS } from "@/lib/subscription";
import type { BillingInterval, PlanPrice } from "@/lib/subscription-plans";
import { PLATFORM_AI_PRO_NAME } from "@/lib/brand";
import {
  clearCheckoutReferralCode,
  loadCheckoutReferralCode,
} from "@/lib/referral-storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrialCheckoutClient({
  interval,
  locale,
  displayPrice,
  canApplyReferralCode = false,
}: {
  interval: BillingInterval;
  locale: CheckoutLocale;
  displayPrice: PlanPrice;
  canApplyReferralCode?: boolean;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const saved = loadCheckoutReferralCode();
    if (saved && canApplyReferralCode) setReferralCode(saved);
  }, [canApplyReferralCode]);

  const handleSuccess = (payload: AddCardData) => {
    setError(null);
    startTransition(async () => {
      const result = await startAiProTrialWithCard({
        interval,
        cardPayload: payload,
        referralCode: canApplyReferralCode ? referralCode : undefined,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      clearCheckoutReferralCode();
      router.push("/dashboard?trial=started");
      router.refresh();
    });
  };

  const handleError = (paymentError: PaymentErrorResponse) => {
    console.error("[TrialCheckout] add card error", paymentError);
    setError(platform.checkout.paymentFailed);
  };

  const perLabel =
    interval === "annual" ? platform.pricing.perYear : platform.pricing.perMonth;

  return (
    <CheckoutLayout
      backHref="/dashboard/pricing"
      title={platform.trialCheckout.title}
      subtitle={platform.trialCheckout.subtitle(FREE_TRIAL_DAYS)}
      totalLabel={platform.trialCheckout.todayTotal}
      summary={
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{PLATFORM_AI_PRO_NAME}</p>
              <p className="text-sm text-muted-foreground">
                {platform.trialCheckout.chargeLater(
                  displayPrice.label,
                  perLabel,
                  FREE_TRIAL_DAYS
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {platform.trialCheckout.cancelAnytime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {platform.trialCheckout.secureBlurb}
          </div>
        </div>
      }
      payment={
        <div className="space-y-3">
          {canApplyReferralCode && !isPending ? (
            <div className="space-y-1.5">
              <Label htmlFor="trial-referral">{platform.referral.enterCode}</Label>
              <Input
                id="trial-referral"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder={platform.referral.codePlaceholder}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ) : null}
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {platform.trialCheckout.starting}
            </div>
          ) : (
            <PokPayAddCard
              locale={locale}
              buttonTitle={platform.trialCheckout.submitCard}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      }
    />
  );
}
