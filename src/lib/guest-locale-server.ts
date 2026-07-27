import { cookies } from "next/headers";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { DEFAULT_CHECKOUT_LOCALE, parseCheckoutLocale } from "@/lib/checkout-i18n";
import { LOCALE_COOKIE_NAME } from "@/lib/guest-locale";

export async function getRequestLocale(): Promise<CheckoutLocale> {
  try {
    const store = await cookies();
    return parseCheckoutLocale(store.get(LOCALE_COOKIE_NAME)?.value);
  } catch {
    return DEFAULT_CHECKOUT_LOCALE;
  }
}
