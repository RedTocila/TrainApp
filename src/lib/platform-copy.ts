import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { platformCopyAl } from "@/lib/platform-copy-al";
import { platformCopyEn } from "@/lib/platform-copy-en";

export type PlatformCopy = typeof platformCopyEn | typeof platformCopyAl;

export function getPlatformCopy(locale: CheckoutLocale): PlatformCopy {
  return locale === "en" ? platformCopyEn : platformCopyAl;
}

export function getHtmlLang(locale: CheckoutLocale): string {
  return locale === "en" ? "en" : "sq";
}
