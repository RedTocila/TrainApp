"use client";

import { useRouter } from "next/navigation";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { Lock } from "lucide-react";
import { useState } from "react";
import type { PlanRequestType } from "@/lib/types";
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

export function CustomPlanCheckoutClient({
  pokpayOrderId,
  localOrderId,
  planType,
  locale,
}: {
  pokpayOrderId: string;
  localOrderId: string;
  planType: PlanRequestType;
  locale: "al" | "en";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const successUrl = `/dashboard/checkout/custom-success?localOrderId=${localOrderId}&type=${planType}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="h-4 w-4 text-primary" />
          Processed with PokPay
        </div>
      </div>

      {error && (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">We couldn’t start checkout.</p>
          <p className="text-sm text-red-200/90">{error}</p>
        </div>
      )}

      <div
        className={cn("pokpay-checkout rounded-2xl border border-border bg-card/70 p-4 backdrop-blur")}
      >
        <GuestCheckoutForm
          orderId={pokpayOrderId}
          onSuccess={() => router.push(successUrl)}
          onError={(paymentError: PaymentErrorResponse) => {
            setError(formatPokPayError(paymentError));
          }}
          options={{
            env: getPokPayClientEnv(),
            locale,
            countrySelect: "modal",
          }}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">Payments are processed by PokPay.</p>
    </div>
  );
}
