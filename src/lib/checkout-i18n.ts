export type CheckoutCurrency = "ALL" | "EUR";
export type CheckoutLocale = "al" | "en";

export const DEFAULT_CHECKOUT_CURRENCY: CheckoutCurrency = "ALL";
export const DEFAULT_CHECKOUT_LOCALE: CheckoutLocale = "al";

export const CHECKOUT_CURRENCIES: { value: CheckoutCurrency; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "EUR", label: "EUR" },
];

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

export function parseCheckoutCurrency(value?: string | null): CheckoutCurrency {
  return value === "EUR" ? "EUR" : "ALL";
}

export function parseCheckoutLocale(value?: string | null): CheckoutLocale {
  return value === "en" ? "en" : "al";
}

/** Convert €X.XX to ALL minor units using live ALL-per-EUR rate. */
export function eurCentsToAllCents(eurCents: number, allPerEur: number): number {
  const eurMajor = eurCents / 100;
  const allMajor = eurMajor * allPerEur;
  return Math.round(allMajor * 100);
}

export function toCurrencyCents(
  amountEurCents: number,
  currency: CheckoutCurrency,
  allPerEur: number
): number {
  if (currency === "EUR") return amountEurCents;
  return eurCentsToAllCents(amountEurCents, allPerEur);
}

export function toCurrencyAmount(
  amountEurCents: number,
  currency: CheckoutCurrency,
  allPerEur: number
): CurrencyAmount {
  const amountCents = toCurrencyCents(amountEurCents, currency, allPerEur);
  return {
    amountCents,
    label: formatCurrencyAmount(amountCents, currency),
  };
}

export function getCurrencyPrice(
  price: PriceInEur,
  currency: CheckoutCurrency,
  allPerEur: number
): CurrencyAmount {
  return toCurrencyAmount(price.amountEurCents, currency, allPerEur);
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
  const major = amountCents / 100;
  const whole = amountCents % 100 === 0;
  const formatted = whole
    ? major.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `ALL ${formatted}`;
}

export function formatAnnualSavings(
  monthlyEurCents: number,
  annualEurCents: number,
  currency: CheckoutCurrency,
  allPerEur: number
): string | null {
  const savedEurCents = monthlyEurCents * 12 - annualEurCents;
  if (savedEurCents <= 0) return null;
  const savedCents = toCurrencyCents(savedEurCents, currency, allPerEur);
  return `Save ${formatCurrencyAmount(savedCents, currency)}/year`;
}

/**
 * PokPay order amounts use whole currency units (e.g. 100 Lek, 1 EUR),
 * not minor units. Our app stores/prices in minor units (×100).
 */
export function toPokPayAmount(amountCents: number): number {
  return Math.round(amountCents / 100);
}
