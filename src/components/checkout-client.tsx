"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { ArrowLeft, CreditCard, Lock, Loader2 } from "lucide-react";
import { createCheckoutOrder } from "@/lib/actions/subscriptions";
import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlan } from "@/lib/subscription-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CheckoutClient({
  planId,
  interval,
}: {
  planId: SubscriptionPlanId;
  interval: BillingInterval;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const plan = getPlan(planId);
  const price = plan
    ? interval === "monthly"
      ? plan.monthly
      : plan.annual
    : null;

  useEffect(() => {
    startTransition(async () => {
      const result = await createCheckoutOrder(planId, interval);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("orderId" in result && result.orderId) {
        setOrderId(result.orderId);
        setLocalOrderId(result.localOrderId ?? null);
      }
    });
  }, [planId, interval]);

  const handleSuccess = () => {
    if (localOrderId) {
      router.push(`/dashboard/checkout/success?localOrderId=${localOrderId}`);
      return;
    }
    router.push("/dashboard/checkout/success");
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/pricing"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Lock className="h-4 w-4" />
          Secure checkout
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-card">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Checkout
              </CardTitle>
              {plan && price && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.name} · {interval === "monthly" ? "Monthly" : "Annual"}
                </p>
              )}
            </div>
            {price && (
              <div className="shrink-0 rounded-xl border border-border bg-card/70 px-3 py-2 text-right backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="text-lg font-black">{price.label}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              Processed with PokPay
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          {isPending && !orderId && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing secure checkout…
            </div>
          )}

          {error && (
            <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-300">We couldn’t start checkout.</p>
              <p className="text-sm text-red-200/90">{error}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          )}

          {orderId && !error && (
            <div
              className={cn(
                "pokpay-checkout rounded-2xl border border-border bg-card/70 p-4 backdrop-blur",
                "[&_[data-testid='pokpay-title']]:hidden"
              )}
            >
              <GuestCheckoutForm
                orderId={orderId}
                onSuccess={handleSuccess}
                onError={(paymentError: PaymentErrorResponse) => {
                  setError(paymentError.message ?? "Payment failed. Please try again.");
                }}
                options={{
                  env:
                    process.env.NEXT_PUBLIC_POKPAY_ENV === "production"
                      ? "production"
                      : "staging",
                  locale: "en",
                  countrySelect: "modal",
                }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Payments are processed by PokPay.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
