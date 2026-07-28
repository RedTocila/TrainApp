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

function syncPokPayEmailField(root: HTMLElement, email?: string, hide = false) {
  const hideElement = (el: Element | null) => {
    if (!el || !(el instanceof HTMLElement)) return;
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
  };

  const maybeEmailInputs = Array.from(root.querySelectorAll<HTMLInputElement>("input")).filter(
    (input) => {
      const attrs = [
        input.type,
        input.name,
        input.id,
        input.placeholder,
        input.getAttribute("autocomplete") ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return attrs.includes("email") || attrs.includes("@");
    }
  );

  maybeEmailInputs.forEach((emailInput) => {
    if (email && emailInput.value !== email) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (!hide) return;

    emailInput.removeAttribute("required");
    hideElement(emailInput);
    hideElement(emailInput.parentElement);
    hideElement(emailInput.closest(".pok-payment-input-row"));

    const inputId = emailInput.id;
    if (inputId) {
      const label = root.querySelector<HTMLLabelElement>(`label[for='${inputId}']`);
      hideElement(label);
    }
  });

  if (!hide) return;

  const labels = Array.from(root.querySelectorAll<HTMLElement>("label, .pok-payment-label"));
  labels.forEach((label) => {
    const text = label.textContent?.trim().toLowerCase() ?? "";
    if (!text.includes("email") && !text.includes("e-mail")) return;
    hideElement(label);
    hideElement(label.closest(".pok-payment-field"));
    hideElement(label.parentElement);
  });
}

export function PokPayGuestCheckout({
  orderId,
  locale,
  email,
  hideEmailField = false,
  onSuccess,
  onError,
}: {
  orderId: string;
  locale: CheckoutLocale;
  email?: string;
  hideEmailField?: boolean;
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
    syncPokPayEmailField(root, email, hideEmailField);

    const observer = new MutationObserver(() => {
      applyPokPaySubmitLabel(root, submitLabel);
      syncPokPayEmailField(root, email, hideEmailField);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [email, hideEmailField, orderId, submitLabel]);

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
