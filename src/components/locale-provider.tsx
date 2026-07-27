"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { DEFAULT_CHECKOUT_LOCALE } from "@/lib/checkout-i18n";
import {
  formatHeightFromCm,
  formatHeightWithUnitFromCm,
  formatWeightFromKg,
  formatWeightFromKgForInput,
  formatWeightWithUnitFromKg,
  heightInputPlaceholder,
  heightLabel,
  heightUnitLabel,
  maxWeightInput,
  parseHeightToCm,
  parseWeightToKg,
  weightInputPlaceholder,
  weightLabel,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/body-units";
import { getCoachCopy, getCoachLabels } from "@/lib/coach-copy";
import { persistGuestLocale, readStoredGuestLocale } from "@/lib/guest-locale";
import { getPlatformCopy } from "@/lib/platform-copy";

type LocaleContextValue = {
  locale: CheckoutLocale;
  unitSystem: UnitSystem;
  setLocalePreview: (locale: CheckoutLocale) => void;
  /** Change language immediately and persist for guests (cookie + localStorage). */
  setLocale: (locale: CheckoutLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_CHECKOUT_LOCALE,
  unitSystem: "metric",
  setLocalePreview: () => {},
  setLocale: () => {},
});

export function LocaleProvider({
  locale: serverLocale,
  unitSystem: serverUnitSystem = "metric",
  /** When true, hydrate from localStorage if present (public pages). */
  syncGuestStorage = false,
  children,
}: {
  locale: CheckoutLocale;
  unitSystem?: UnitSystem;
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
      unitSystem: serverUnitSystem,
      setLocalePreview: setPreview,
      setLocale,
    }),
    [preview, serverLocale, serverUnitSystem]
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

export function useUnitSystem(): UnitSystem {
  return useContext(LocaleContext).unitSystem;
}

export function useBodyUnits() {
  const unitSystem = useUnitSystem();

  return useMemo(
    () => ({
      unitSystem,
      weightUnit: weightUnitLabel(unitSystem),
      heightUnit: heightUnitLabel(unitSystem),
      weightFieldLabel: weightLabel(unitSystem),
      heightFieldLabel: heightLabel(unitSystem),
      weightPlaceholder: weightInputPlaceholder(unitSystem),
      heightPlaceholder: heightInputPlaceholder(unitSystem),
      formatWeightKg: (kg: number) => formatWeightFromKg(kg, unitSystem),
      formatWeightKgInput: (kg: number) =>
        formatWeightFromKgForInput(kg, unitSystem),
      formatWeightKgWithUnit: (kg: number) =>
        formatWeightWithUnitFromKg(kg, unitSystem),
      parseWeightInput: (raw: string) => parseWeightToKg(raw, unitSystem),
      formatHeightCm: (cm: number) => formatHeightFromCm(cm, unitSystem),
      formatHeightCmWithUnit: (cm: number) =>
        formatHeightWithUnitFromCm(cm, unitSystem),
      parseHeightInput: (raw: string) => parseHeightToCm(raw, unitSystem),
      maxWeightInput: maxWeightInput(unitSystem),
    }),
    [unitSystem]
  );
}
