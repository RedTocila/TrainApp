"use client";

import type { CheckoutCurrency, CheckoutLocale } from "@/lib/checkout-i18n";
import {
  CHECKOUT_CURRENCIES,
  CHECKOUT_LOCALES,
} from "@/lib/checkout-i18n";
import { cn } from "@/lib/utils";

export function CheckoutCurrencyToggle({
  currency,
  onCurrencyChange,
  className,
}: {
  currency: CheckoutCurrency;
  onCurrencyChange: (currency: CheckoutCurrency) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
        {CHECKOUT_CURRENCIES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCurrencyChange(option.value)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              currency === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckoutLocaleToggle({
  locale,
  onLocaleChange,
  className,
}: {
  locale: CheckoutLocale;
  onLocaleChange: (locale: CheckoutLocale) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
        {CHECKOUT_LOCALES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onLocaleChange(option.value)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              locale === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
