"use client";

import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { CHECKOUT_LOCALES } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { cn } from "@/lib/utils";

export function CheckoutLocaleToggle({
  locale,
  onLocaleChange,
  className,
}: {
  locale: CheckoutLocale;
  onLocaleChange: (locale: CheckoutLocale) => void;
  className?: string;
}) {
  const platform = getPlatformCopy(locale);

  return (
    <div className={cn("flex justify-center", className)}>
      <SegmentedToggle
        value={locale}
        onChange={onLocaleChange}
        aria-label={platform.settings.language}
        className="w-auto"
        options={CHECKOUT_LOCALES}
      />
    </div>
  );
}
