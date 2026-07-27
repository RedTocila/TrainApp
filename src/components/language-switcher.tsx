"use client";

import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { CHECKOUT_LOCALES } from "@/lib/checkout-i18n";
import { useLocale, usePlatformCopy, useSetLocale } from "@/components/locale-provider";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const platform = usePlatformCopy();

  return (
    <div className={cn("flex justify-center", className)}>
      <SegmentedToggle
        value={locale}
        onChange={(next) => setLocale(next as CheckoutLocale)}
        aria-label={platform.settings.language}
        className={cn("w-auto", size === "sm" && "text-xs")}
        options={CHECKOUT_LOCALES}
      />
    </div>
  );
}
