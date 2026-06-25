"use client";

import { useRouter } from "next/navigation";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { CreditCard, Lock } from "lucide-react";
import { useState } from "react";
import type { PlanRequestType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CustomPlanCheckoutClient({
  pokpayOrderId,
  localOrderId,
  planType,
}: {
  pokpayOrderId: string;
  localOrderId: string;
  planType: PlanRequestType;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const successUrl = `/dashboard/checkout/custom-success?localOrderId=${localOrderId}&type=${planType}`;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-card">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Checkout</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" />
            Secure payment
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {error && (
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-300">We couldn’t start checkout.</p>
            <p className="text-sm text-red-200/90">{error}</p>
          </div>
        )}

        <div
          className={cn(
            "pokpay-checkout rounded-2xl border border-border bg-card/70 p-4 backdrop-blur",
            "[&_*]:!text-[15px] sm:[&_*]:!text-[16px]"
          )}
        >
          <GuestCheckoutForm
            orderId={pokpayOrderId}
            onSuccess={() => router.push(successUrl)}
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

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed by PokPay.
        </p>
      </CardContent>
    </Card>
  );
}
