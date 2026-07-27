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
  /** Optional compare-at / list price for strikethrough UI. */
  compareAtEurCents?: number;
}

export function getCurrencyPrice(price: PriceInEur): CurrencyAmount {
  return {
    amountCents: price.amountEurCents,
    label: formatCurrencyAmount(price.amountEurCents),
  };
}

/** Strikethrough compare-at label when higher than the selling price. */
export function getCompareAtLabel(price: PriceInEur): string | null {
  const compareAt = price.compareAtEurCents;
  if (compareAt == null || compareAt <= price.amountEurCents) return null;
  return formatCurrencyAmount(compareAt);
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

/** Full yearly price if billed monthly — used as strikethrough compare-at on annual. */
export function getAnnualCompareAtLabel(
  monthly: PriceInEur,
  annual: PriceInEur
): string | null {
  if (annual.compareAtEurCents != null) {
    return getCompareAtLabel(annual);
  }
  const compareAtCents = monthly.amountEurCents * 12;
  if (compareAtCents <= annual.amountEurCents) return null;
  return formatCurrencyAmount(compareAtCents);
}

/**
 * PokPay order amounts use whole currency units (e.g. 1 EUR),
 * not minor units. Our app stores/prices in minor units (×100).
 */
export function toPokPayAmount(amountCents: number): number {
  return Math.round(amountCents / 100);
}
