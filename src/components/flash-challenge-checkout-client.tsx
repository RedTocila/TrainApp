"use client";

import { useRouter } from "next/navigation";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { Lock } from "lucide-react";
import { PokPayGuestCheckout } from "@/components/pokpay-guest-checkout";
import { useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";

function formatPokPayError(err: unknown, paymentFailed: string): string {
  if (!err || typeof err !== "object") return paymentFailed;
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
    message ?? paymentFailed,
    code ? `code=${code}` : null,
    statusCode ? `status=${statusCode}` : null,
    details ? `details=${details}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function FlashChallengeCheckoutClient({
  pokpayOrderId,
  localOrderId,
  locale,
  challengeTitle,
  backHref,
}: {
  pokpayOrderId: string;
  localOrderId: string;
  locale: "al" | "en";
  challengeTitle: string;
  backHref: string;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const successUrl = `/dashboard/checkout/flash-challenge/success?localOrderId=${localOrderId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="h-4 w-4 text-primary" />
          {platform.checkoutFlow.secureBadge}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {platform.challenges.join.flashCheckoutNote.replace("{title}", challengeTitle)}
      </p>

      {error ? (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            {platform.checkoutFlow.checkoutErrorTitle}
          </p>
          <p className="text-sm text-red-200/90">{error}</p>
        </div>
      ) : null}

      <PokPayGuestCheckout
        orderId={pokpayOrderId}
        locale={locale}
        onSuccess={() => router.push(successUrl)}
        onError={(paymentError: PaymentErrorResponse) => {
          setError(formatPokPayError(paymentError, platform.checkout.paymentFailed));
        }}
      />

      <p className="text-center text-xs text-muted-foreground">
        {platform.checkoutFlow.processorNote}
      </p>
    </div>
  );
}
