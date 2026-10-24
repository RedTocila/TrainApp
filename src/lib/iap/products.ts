import type { BillingInterval, SoldSubscriptionPlanId } from "@/lib/subscription-plans";

/** Plans sold in the App Store. Legacy AI and Elite ids still restore. */
export type AppleIapPlanId = SoldSubscriptionPlanId;

/** Bundle ID / Capacitor appId — must match App Store Connect. */
export const APPLE_BUNDLE_ID = "al.rutina.app";

/**
 * Auto-renewable subscription product IDs.
 * Create these exact IDs in App Store Connect → Subscriptions.
 */
export const IAP_PRODUCT_IDS = {
  plus: {
    monthly: "al.rutina.app.plus.monthly",
    annual: "al.rutina.app.plus.annual",
  },
  pro: {
    monthly: "al.rutina.app.pro.monthly",
    annual: "al.rutina.app.pro.annual",
  },
} as const satisfies Record<AppleIapPlanId, Record<BillingInterval, string>>;

/** Previous App Store products. Not sold anymore; restore still recognizes them. */
const LEGACY_IAP_PRODUCT_IDS = {
  ai: {
    monthly: "al.rutina.app.ai.monthly",
    annual: "al.rutina.app.ai.annual",
  },
  elite: {
    monthly: "al.rutina.app.elite.monthly",
    annual: "al.rutina.app.elite.annual",
  },
} as const;

export const ALL_IAP_PRODUCT_IDS: string[] = [
  IAP_PRODUCT_IDS.plus.monthly,
  IAP_PRODUCT_IDS.plus.annual,
  IAP_PRODUCT_IDS.pro.monthly,
  IAP_PRODUCT_IDS.pro.annual,
];

export function getIapProductId(
  planId: AppleIapPlanId,
  interval: BillingInterval
): string {
  return IAP_PRODUCT_IDS[planId][interval];
}

export function parseIapProductId(
  productId: string
): { planId: AppleIapPlanId | "ai" | "elite"; interval: BillingInterval } | null {
  const catalogs = [IAP_PRODUCT_IDS, LEGACY_IAP_PRODUCT_IDS] as const;
  for (const catalog of catalogs) {
    for (const planId of Object.keys(catalog) as (keyof typeof catalog)[]) {
      for (const interval of ["monthly", "annual"] as const) {
        if (catalog[planId][interval] === productId) {
          return { planId, interval };
        }
      }
    }
  }
  return null;
}
