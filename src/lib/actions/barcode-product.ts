"use server";

import { createClient } from "@/lib/supabase/server";
import { lookupOpenFoodFactsBarcode } from "@/lib/open-food-facts";
import { formatUserError } from "@/lib/format-user-error";
import type { MealFormData } from "@/lib/meal-utils";

export type LookupBarcodeProductResult =
  | {
      found: true;
      form: MealFormData;
      imageUrl: string | null;
      barcode: string;
      confidence: number;
    }
  | { found: false; barcode: string; error?: string }
  | { error: string };

export async function lookupBarcodeProductAction(
  barcode: string
): Promise<LookupBarcodeProductResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cleaned = barcode.trim();
  if (!cleaned) return { error: "No barcode provided" };

  try {
    const result = await lookupOpenFoodFactsBarcode(cleaned);
    if (!result.found) {
      return {
        found: false,
        barcode: result.barcode,
        error: "Product not found for that barcode",
      };
    }
    return {
      found: true,
      form: result.form,
      imageUrl: result.imageUrl,
      barcode: result.barcode,
      confidence: 0.95,
    };
  } catch (error) {
    return {
      error: formatUserError(error, "Failed to look up barcode"),
    };
  }
}
