import type { BillingInterval, SoldSubscriptionPlanId } from "@/lib/subscription-plans";

/** Bundle ID / Capacitor appId — must match App Store Connect. */
export const APPLE_BUNDLE_ID = "al.rutina.app";

/**
 * Auto-renewable subscription product IDs.
 * Create these exact IDs in App Store Connect → Subscriptions.
 */
export const IAP_PRODUCT_IDS = {
  ai: {
    monthly: "al.rutina.app.ai.monthly",
    annual: "al.rutina.app.ai.annual",
  },
  elite: {
    monthly: "al.rutina.app.elite.monthly",
    annual: "al.rutina.app.elite.annual",
  },
} as const satisfies Record<
  SoldSubscriptionPlanId,
  Record<BillingInterval, string>
>;

export const ALL_IAP_PRODUCT_IDS: string[] = [
  IAP_PRODUCT_IDS.ai.monthly,
  IAP_PRODUCT_IDS.ai.annual,
  IAP_PRODUCT_IDS.elite.monthly,
  IAP_PRODUCT_IDS.elite.annual,
];

export function getIapProductId(
  planId: SoldSubscriptionPlanId,
  interval: BillingInterval
): string {
  return IAP_PRODUCT_IDS[planId][interval];
}

export function parseIapProductId(
  productId: string
): { planId: SoldSubscriptionPlanId; interval: BillingInterval } | null {
  for (const planId of ["ai", "elite"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      if (IAP_PRODUCT_IDS[planId][interval] === productId) {
        return { planId, interval };
      }
    }
  }
  return null;
}
