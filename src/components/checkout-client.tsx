"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { CreditCard, Lock, Loader2, ShieldCheck } from "lucide-react";
import { createCheckoutOrder } from "@/lib/actions/subscriptions";
import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlan } from "@/lib/subscription-plans";
import { Button } from "@/components/ui/button";
import { CheckoutLayout } from "@/components/checkout-layout";
import { cn } from "@/lib/utils";
import { getPokPayClientEnv } from "@/lib/pokpay/env";

function formatPokPayError(err: unknown): string {
  if (!err || typeof err !== "object") return "Payment failed. Please try again.";
  const anyErr = err as Record<string, unknown>;
  const message = typeof anyErr.message === "string" ? anyErr.message : null;
  const code = typeof anyErr.code === "string" ? anyErr.code : null;
  const statusCode =
    typeof anyErr.statusCode === "number" ? String(anyErr.statusCode) : null;
  const details =
    typeof anyErr.details === "string"
      ? anyErr.details
      : Array.isArray(anyErr.errors)
        ? JSON.stringify(anyErr.errors)
        : null;

  return [
    message ?? "Payment failed.",
    code ? `code=${code}` : null,
    statusCode ? `status=${statusCode}` : null,
    details ? `details=${details}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

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

  const intervalLabel = interval === "monthly" ? "Monthly" : "Annual";

  return (
    <CheckoutLayout
      backHref="/dashboard/pricing"
      title="Checkout"
      subtitle={plan ? `${plan.name} · ${intervalLabel}` : "Complete your purchase"}
      totalLabel={price?.label}
      summary={
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Plan</p>
                <p className="text-lg font-black leading-tight">{plan?.name ?? "Subscription"}</p>
                <p className="text-sm text-muted-foreground">{intervalLabel} billing</p>
              </div>
              {price ? (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-muted-foreground">Price</p>
                  <p className="text-xl font-black">{price.label}</p>
                </div>
              ) : null}
            </div>
          </div>

          {plan?.features?.length ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Includes</p>
              <ul className="space-y-2">
                {plan.features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              Secure payment
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4 text-primary" />
              Cards & wallets supported
            </div>
          </div>
        </div>
      }
      payment={
        <>
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
                  setError(formatPokPayError(paymentError));
                }}
                options={{
                  env: getPokPayClientEnv(),
                  locale: "en",
                  countrySelect: "modal",
                }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Payments are processed by PokPay.
          </p>
        </>
      }
    />
  );
}
