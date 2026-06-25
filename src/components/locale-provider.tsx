"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { DEFAULT_CHECKOUT_LOCALE } from "@/lib/checkout-i18n";
import { getCoachCopy, getCoachLabels } from "@/lib/coach-copy";
import { getPlatformCopy } from "@/lib/platform-copy";

type LocaleContextValue = {
  locale: CheckoutLocale;
  setLocalePreview: (locale: CheckoutLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_CHECKOUT_LOCALE,
  setLocalePreview: () => {},
});

export function LocaleProvider({
  locale: serverLocale,
  children,
}: {
  locale: CheckoutLocale;
  children: React.ReactNode;
}) {
  const [preview, setPreview] = useState<CheckoutLocale | null>(null);

  useEffect(() => {
    setPreview(null);
  }, [serverLocale]);

  const value = useMemo(
    () => ({
      locale: preview ?? serverLocale,
      setLocalePreview: setPreview,
    }),
    [preview, serverLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): CheckoutLocale {
  return useContext(LocaleContext).locale;
}

export function useLocalePreview(): (locale: CheckoutLocale) => void {
  return useContext(LocaleContext).setLocalePreview;
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
