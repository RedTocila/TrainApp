"use client";

import { AddCardForm } from "@nebula-ltd/pok-payments-js/react";
import type { AddCardData, PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getPokPayClientEnv } from "@/lib/pokpay/env";

export function PokPayAddCard({
  locale,
  buttonTitle,
  onSuccess,
  onError,
}: {
  locale: CheckoutLocale;
  buttonTitle: string;
  onSuccess: (payload: AddCardData) => void;
  onError: (paymentError: PaymentErrorResponse) => void;
}) {
  return (
    <div className="pokpay-checkout [&_[data-testid='pokpay-title']]:hidden">
      <AddCardForm
        buttonTitle={buttonTitle}
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
