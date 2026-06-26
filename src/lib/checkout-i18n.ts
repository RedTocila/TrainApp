export type CheckoutLocale = "al" | "en";

export const DEFAULT_CHECKOUT_LOCALE: CheckoutLocale = "al";
export const CHECKOUT_CURRENCY = "EUR" as const;
export type CheckoutCurrency = typeof CHECKOUT_CURRENCY;

export const CHECKOUT_LOCALES: { value: CheckoutLocale; label: string }[] = [
  { value: "al", label: "Shqip" },
  { value: "en", label: "English" },
];

export interface CurrencyAmount {
  amountCents: number;
  label: string;
}

/** Canonical list prices are stored in EUR minor units (cents). */
export interface PriceInEur {
  amountEurCents: number;
}

export function getCurrencyPrice(price: PriceInEur): CurrencyAmount {
  return {
    amountCents: price.amountEurCents,
    label: formatCurrencyAmount(price.amountEurCents),
  };
}

export function formatEurReference(amountEurCents: number): string {
  const whole = amountEurCents % 100 === 0;
  return whole
    ? `€${(amountEurCents / 100).toFixed(0)}`
    : `€${(amountEurCents / 100).toFixed(2)}`;
}

export function parseCheckoutLocale(value?: string | null): CheckoutLocale {
  return value === "en" ? "en" : "al";
}

export function formatCurrencyAmount(amountCents: number): string {
  const whole = amountCents % 100 === 0;
  return whole
    ? `€${(amountCents / 100).toFixed(0)}`
    : `€${(amountCents / 100).toFixed(2)}`;
}

export function formatAnnualSavings(
  monthly: PriceInEur,
  annual: PriceInEur
): string | null {
  const savedCents = monthly.amountEurCents * 12 - annual.amountEurCents;
  if (savedCents <= 0) return null;
  return `Save ${formatCurrencyAmount(savedCents)}/year`;
}

/**
 * PokPay order amounts use whole currency units (e.g. 1 EUR),
 * not minor units. Our app stores/prices in minor units (×100).
 */
export function toPokPayAmount(amountCents: number): number {
  return Math.round(amountCents / 100);
}
