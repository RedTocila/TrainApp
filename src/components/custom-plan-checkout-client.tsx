"use client";

import { useRouter } from "next/navigation";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { useState } from "react";
import type { PlanRequestType } from "@/lib/types";

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
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
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
      <p className="text-center text-xs text-muted-foreground">
        Payments secured by PokPay. Your card details never touch our servers.
      </p>
    </div>
  );
}
