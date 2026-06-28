"use client";

import { useEffect, useRef } from "react";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import { usePlatformCopy } from "@/components/locale-provider";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getPokPayClientEnv } from "@/lib/pokpay/env";

const POKPAY_NATIVE_SUBMIT_LABELS = new Set(["Pay", "Paguaj"]);

function applyPokPaySubmitLabel(root: HTMLElement, label: string) {
  const button = root.querySelector<HTMLButtonElement>(".pok-payment-button");
  if (!button) return;

  const current = button.textContent?.trim() ?? "";
  const alreadyCustomized = button.dataset.rutinaSubmitLabel !== undefined;

  if (!POKPAY_NATIVE_SUBMIT_LABELS.has(current) && !alreadyCustomized) return;
  if (current === label) {
    button.dataset.rutinaSubmitLabel = label;
    return;
  }

  button.textContent = label;
  button.dataset.rutinaSubmitLabel = label;
}

export function PokPayGuestCheckout({
  orderId,
  locale,
  onSuccess,
  onError,
}: {
  orderId: string;
  locale: CheckoutLocale;
  onSuccess: () => void;
  onError: (paymentError: PaymentErrorResponse) => void;
}) {
  const platform = usePlatformCopy();
  const containerRef = useRef<HTMLDivElement>(null);
  const submitLabel = platform.checkoutFlow.pokPaySubmitLabel;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    applyPokPaySubmitLabel(root, submitLabel);

    const observer = new MutationObserver(() => {
      applyPokPaySubmitLabel(root, submitLabel);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [orderId, submitLabel]);

  return (
    <div
      ref={containerRef}
      className="pokpay-checkout [&_[data-testid='pokpay-title']]:hidden"
    >
      <GuestCheckoutForm
        orderId={orderId}
        onSuccess={onSuccess}
        onError={onError}
        options={{
          env: getPokPayClientEnv(),
          locale,
          countrySelect: "modal",
        }}
      />
    </div>
  );
}
