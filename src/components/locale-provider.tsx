"use client";

import { createContext, useContext, useMemo } from "react";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { DEFAULT_CHECKOUT_LOCALE } from "@/lib/checkout-i18n";
import { getCoachCopy, getCoachLabels } from "@/lib/coach-copy";
import { getPlatformCopy } from "@/lib/platform-copy";

const LocaleContext = createContext<CheckoutLocale>(DEFAULT_CHECKOUT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: CheckoutLocale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): CheckoutLocale {
  return useContext(LocaleContext);
}

export function useCoachCopy() {
  const locale = useLocale();
  return useMemo(() => getCoachCopy(locale), [locale]);
}

export function useCoachLabels() {
  const locale = useLocale();
  return useMemo(() => getCoachLabels(locale), [locale]);
}

export function usePlatformCopy() {
  const locale = useLocale();
  return useMemo(() => getPlatformCopy(locale), [locale]);
}
