"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { DEFAULT_CHECKOUT_LOCALE } from "@/lib/checkout-i18n";
import {
  HEIGHT_INPUT_PLACEHOLDER,
  HEIGHT_LABEL,
  HEIGHT_UNIT,
  MAX_WEIGHT_INPUT,
  WEIGHT_INPUT_PLACEHOLDER,
  WEIGHT_LABEL,
  WEIGHT_UNIT,
  formatHeightFromCm,
  formatHeightWithUnitFromCm,
  formatWeightFromKg,
  formatWeightFromKgForInput,
  formatWeightWithUnitFromKg,
  parseHeightToCm,
  parseWeightToKg,
} from "@/lib/body-units";
import { getCoachCopy, getCoachLabels } from "@/lib/coach-copy";
import { persistGuestLocale, readStoredGuestLocale } from "@/lib/guest-locale";
import { getPlatformCopy } from "@/lib/platform-copy";

type LocaleContextValue = {
  locale: CheckoutLocale;
  setLocalePreview: (locale: CheckoutLocale) => void;
  /** Change language immediately and persist for guests (cookie + localStorage). */
  setLocale: (locale: CheckoutLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_CHECKOUT_LOCALE,
  setLocalePreview: () => {},
  setLocale: () => {},
});

export function LocaleProvider({
  locale: serverLocale,
  /** When true, hydrate from localStorage if present (public pages). */
  syncGuestStorage = false,
  children,
}: {
  locale: CheckoutLocale;
  syncGuestStorage?: boolean;
  children: React.ReactNode;
}) {
  const [preview, setPreview] = useState<CheckoutLocale | null>(null);

  useEffect(() => {
    setPreview(null);
  }, [serverLocale]);

  useEffect(() => {
    if (!syncGuestStorage) return;
    const stored = readStoredGuestLocale();
    if (stored && stored !== serverLocale) {
      setPreview(stored);
      persistGuestLocale(stored);
    }
  }, [syncGuestStorage, serverLocale]);

  const setLocale = (next: CheckoutLocale) => {
    setPreview(next);
    persistGuestLocale(next);
  };

  const value = useMemo(
    () => ({
      locale: preview ?? serverLocale,
      setLocalePreview: setPreview,
      setLocale,
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

export function useSetLocale(): (locale: CheckoutLocale) => void {
  return useContext(LocaleContext).setLocale;
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

const BODY_UNITS = {
  weightUnit: WEIGHT_UNIT,
  heightUnit: HEIGHT_UNIT,
  weightFieldLabel: WEIGHT_LABEL,
  heightFieldLabel: HEIGHT_LABEL,
  weightPlaceholder: WEIGHT_INPUT_PLACEHOLDER,
  heightPlaceholder: HEIGHT_INPUT_PLACEHOLDER,
  formatWeightKg: formatWeightFromKg,
  formatWeightKgInput: formatWeightFromKgForInput,
  formatWeightKgWithUnit: formatWeightWithUnitFromKg,
  parseWeightInput: parseWeightToKg,
  formatHeightCm: formatHeightFromCm,
  formatHeightCmWithUnit: formatHeightWithUnitFromCm,
  parseHeightInput: parseHeightToCm,
  maxWeightInput: MAX_WEIGHT_INPUT,
} as const;

export function useBodyUnits() {
  return BODY_UNITS;
}
