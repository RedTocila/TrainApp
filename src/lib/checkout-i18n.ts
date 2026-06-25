export type CheckoutCurrency = "ALL" | "EUR";
export type CheckoutLocale = "al" | "en";

export const DEFAULT_CHECKOUT_CURRENCY: CheckoutCurrency = "ALL";
export const DEFAULT_CHECKOUT_LOCALE: CheckoutLocale = "al";

export const CHECKOUT_CURRENCIES: { value: CheckoutCurrency; label: string }[] = [
  { value: "ALL", label: "ALL (Lek)" },
  { value: "EUR", label: "EUR (€)" },
];

export const CHECKOUT_LOCALES: { value: CheckoutLocale; label: string }[] = [
  { value: "al", label: "Shqip" },
  { value: "en", label: "English" },
];

export interface CurrencyAmount {
  amountCents: number;
  label: string;
}

export interface MultiCurrencyPrice {
  ALL: CurrencyAmount;
  EUR: CurrencyAmount;
}

export function parseCheckoutCurrency(value?: string | null): CheckoutCurrency {
  return value === "EUR" ? "EUR" : "ALL";
}

export function parseCheckoutLocale(value?: string | null): CheckoutLocale {
  return value === "en" ? "en" : "al";
}

export function getCurrencyPrice(
  price: MultiCurrencyPrice,
  currency: CheckoutCurrency
): CurrencyAmount {
  return price[currency];
}

export function formatCurrencyAmount(
  amountCents: number,
  currency: CheckoutCurrency
): string {
  if (currency === "EUR") {
    const whole = amountCents % 100 === 0;
    return whole
      ? `€${(amountCents / 100).toFixed(0)}`
      : `€${(amountCents / 100).toFixed(2)}`;
  }
  const whole = amountCents % 100 === 0;
  return whole
    ? `L${(amountCents / 100).toFixed(0)}`
    : `L${(amountCents / 100).toFixed(2)}`;
}

export function formatAnnualSavings(
  monthlyCents: number,
  annualCents: number,
  currency: CheckoutCurrency
): string | null {
  const saved = monthlyCents * 12 - annualCents;
  if (saved <= 0) return null;
  return `Save ${formatCurrencyAmount(saved, currency)}/year`;
}
