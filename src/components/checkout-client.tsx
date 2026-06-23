"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createCheckoutOrder } from "@/lib/actions/subscriptions";
import type { BillingInterval, SubscriptionPlanId } from "@/lib/subscription-plans";
import { getPlan } from "@/lib/subscription-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/dashboard/pricing"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to pricing
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Checkout</CardTitle>
          {plan && price && (
            <p className="text-sm text-muted-foreground">
              {plan.name} · {interval === "monthly" ? "Monthly" : "Annual"} · {price.label}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isPending && !orderId && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing secure checkout…
            </div>
          )}

          {error && (
            <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          )}

          {orderId && !error && (
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
          )}

          <p className="text-center text-xs text-muted-foreground">
            Payments secured by PokPay. Your card details never touch our servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
