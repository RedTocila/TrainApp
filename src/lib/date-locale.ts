import { format, type Locale } from "date-fns";
import { enUS, sq } from "date-fns/locale";
import type { CheckoutLocale } from "@/lib/checkout-i18n";

export function getDateFnsLocale(locale: CheckoutLocale): Locale {
  return locale === "en" ? enUS : sq;
}

export function formatLocalized(
  date: Date | number,
  formatStr: string,
  locale: CheckoutLocale
): string {
  return format(date, formatStr, { locale: getDateFnsLocale(locale) });
}
