"use client";

import { useState } from "react";
import { PricingPlans } from "@/components/pricing-plans";
import type { BillingInterval } from "@/lib/subscription-plans";

export function PublicPricingClient() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <PricingPlans
      interval={interval}
      onIntervalChange={setInterval}
      checkoutBasePath="/register"
    />
  );
}
