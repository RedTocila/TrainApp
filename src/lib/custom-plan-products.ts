import type { CheckoutCurrency, MultiCurrencyPrice } from "@/lib/checkout-i18n";
import { getCurrencyPrice } from "@/lib/checkout-i18n";
import type { PlanRequestType } from "@/lib/types";

export const TRAINER_NAME = "RedTocila";

export interface CustomPlanProduct {
  type: PlanRequestType;
  orderKind: "custom_workout" | "custom_nutrition";
  title: string;
  description: string;
  pricing: MultiCurrencyPrice;
}

export const CUSTOM_PLAN_PRODUCTS: CustomPlanProduct[] = [
  {
    type: "workout",
    orderKind: "custom_workout",
    title: "Custom Workout Plan",
    description: `Personal workout program built by ${TRAINER_NAME} based on your goals and preferences.`,
    pricing: {
      ALL: { amountCents: 490_000, label: "L4,900" },
      EUR: { amountCents: 4900, label: "€49" },
    },
  },
  {
    type: "diet",
    orderKind: "custom_nutrition",
    title: "Custom Nutrition Plan",
    description: `Personal nutrition plan designed by ${TRAINER_NAME} as a PDF tailored to your body and goals.`,
    pricing: {
      ALL: { amountCents: 790_000, label: "L7,900" },
      EUR: { amountCents: 7900, label: "€79" },
    },
  },
];

export function getCustomPlanProduct(type: PlanRequestType): CustomPlanProduct | undefined {
  return CUSTOM_PLAN_PRODUCTS.find((product) => product.type === type);
}

export function getCustomPlanPrice(
  type: PlanRequestType,
  currency: CheckoutCurrency = "ALL"
) {
  const product = getCustomPlanProduct(type);
  if (!product) throw new Error("Unknown custom plan type");
  return getCurrencyPrice(product.pricing, currency);
}
