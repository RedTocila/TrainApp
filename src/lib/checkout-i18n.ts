export type CheckoutCurrency = "ALL" | "EUR";
export type CheckoutLocale = "al" | "en";

export const DEFAULT_CHECKOUT_CURRENCY: CheckoutCurrency = "ALL";
export const DEFAULT_CHECKOUT_LOCALE: CheckoutLocale = "al";

/** 1 EUR = 100 ALL (major units). Amounts are stored in ALL minor units (cent). */
export const ALL_PER_EUR = 100;

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

/** Canonical price stored in ALL minor units (1/100 of a Lek). */
export interface PriceInAll {
  amountAllCents: number;
}

export function parseCheckoutCurrency(value?: string | null): CheckoutCurrency {
  return value === "EUR" ? "EUR" : "ALL";
}

export function parseCheckoutLocale(value?: string | null): CheckoutLocale {
  return value === "en" ? "en" : "al";
}

export function allCentsToCurrencyCents(
  amountAllCents: number,
  currency: CheckoutCurrency
): number {
  if (currency === "ALL") return amountAllCents;
  return Math.round(amountAllCents / ALL_PER_EUR);
}

export function toCurrencyAmount(
  amountAllCents: number,
  currency: CheckoutCurrency
): CurrencyAmount {
  const amountCents = allCentsToCurrencyCents(amountAllCents, currency);
  return {
    amountCents,
    label: formatCurrencyAmount(amountCents, currency),
  };
}

export function getCurrencyPrice(
  price: PriceInAll,
  currency: CheckoutCurrency
): CurrencyAmount {
  return toCurrencyAmount(price.amountAllCents, currency);
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
  return `L${formatted}`;
}

export function formatAnnualSavings(
  monthlyAllCents: number,
  annualAllCents: number,
  currency: CheckoutCurrency
): string | null {
  const savedAll = monthlyAllCents * 12 - annualAllCents;
  if (savedAll <= 0) return null;
  const saved = allCentsToCurrencyCents(savedAll, currency);
  return `Save ${formatCurrencyAmount(saved, currency)}/year`;
}
