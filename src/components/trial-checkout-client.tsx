"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AddCardData, PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { AppleIapCheckout } from "@/components/apple-iap-checkout";
import { PokPayAddCard } from "@/components/pokpay-add-card";
import { CheckoutLayout } from "@/components/checkout-layout";
import { usePlatformCopy } from "@/components/locale-provider";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import {
  completeAppleCheckoutPurchase,
  createAppleCheckoutOrder,
} from "@/lib/actions/iap";
import { startAiProTrialWithCard } from "@/lib/actions/trial-subscription";
import { FREE_TRIAL_DAYS } from "@/lib/subscription";
import type { BillingInterval, PlanPrice } from "@/lib/subscription-plans";
import { PLATFORM_AI_PRO_NAME } from "@/lib/brand";
import {
  clearCheckoutReferralCode,
  loadCheckoutReferralCode,
} from "@/lib/referral-storage";
import { shouldUseAppleIap } from "@/lib/native-iap";
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
  const useAppleIap = shouldUseAppleIap();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [referralCode, setReferralCode] = useState("");
  const [appleReady, setAppleReady] = useState<{
    localOrderId: string;
    productId: string;
    appAccountToken: string;
  } | null>(null);

  useEffect(() => {
    const saved = loadCheckoutReferralCode();
    if (saved && canApplyReferralCode) setReferralCode(saved);
  }, [canApplyReferralCode]);

  useEffect(() => {
    if (!useAppleIap || appleReady) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await createAppleCheckoutOrder("ai", interval, {
        referralCode: canApplyReferralCode ? referralCode || undefined : undefined,
      });
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("localOrderId" in result && result.localOrderId && result.productId) {
        setAppleReady({
          localOrderId: result.localOrderId,
          productId: result.productId,
          appAccountToken: result.appAccountToken,
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // Intentionally once when entering Apple trial checkout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAppleIap, interval]);

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
      title={
        useAppleIap
          ? platform.trialCheckout.appleTitle
          : platform.trialCheckout.title
      }
      subtitle={
        useAppleIap
          ? platform.trialCheckout.appleSubtitle(FREE_TRIAL_DAYS)
          : platform.trialCheckout.subtitle(FREE_TRIAL_DAYS)
      }
      totalLabel={
        useAppleIap
          ? platform.trialCheckout.appleTodayTotal
          : platform.trialCheckout.todayTotal
      }
      summary={
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black">{PLATFORM_AI_PRO_NAME}</p>
              <p className="text-sm text-muted-foreground">
                {displayPrice.label}
                {perLabel}
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {useAppleIap
                ? platform.trialCheckout.appleSecureBlurb
                : platform.trialCheckout.secureBlurb}
            </li>
          </ul>
        </div>
      }
      payment={
        <div className="space-y-4">
          {canApplyReferralCode ? (
            <div className="space-y-1.5">
              <Label htmlFor="trial-referral">{platform.referral.enterCode}</Label>
              <Input
                id="trial-referral"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder={platform.referral.codePlaceholder}
                autoCapitalize="off"
                autoCorrect="off"
                disabled={useAppleIap && Boolean(appleReady)}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {useAppleIap ? (
            appleReady ? (
              <AppleIapCheckout
                productId={appleReady.productId}
                appAccountToken={appleReady.appAccountToken}
                fallbackPriceLabel={displayPrice.label}
                ctaLabel={platform.checkoutFlow.applePrimaryCta}
                preparingLabel={platform.checkoutFlow.preparing}
                processorNote={platform.checkoutFlow.appleProcessorNote}
                onError={setError}
                onPurchased={async (purchase) => {
                  const result = await completeAppleCheckoutPurchase({
                    localOrderId: appleReady.localOrderId,
                    productId: purchase.productId,
                    signedTransaction: purchase.signedTransaction,
                  });
                  if ("error" in result && result.error) {
                    setError(result.error);
                    return;
                  }
                  clearCheckoutReferralCode();
                  router.push("/dashboard?subscribed=1");
                  router.refresh();
                }}
              />
            ) : (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {platform.checkoutFlow.preparing}
              </div>
            )
          ) : (
            <PokPayAddCard
              locale={locale}
              buttonTitle={
                isPending
                  ? platform.trialCheckout.starting
                  : platform.trialCheckout.submitCard
              }
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}
        </div>
      }
    />
  );
}
