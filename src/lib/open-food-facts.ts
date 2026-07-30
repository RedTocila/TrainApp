import type { MealFormData } from "@/lib/meal-utils";

type OffNutriments = Record<string, number | string | undefined>;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  image_url?: string;
  image_front_url?: string;
  nutriments?: OffNutriments;
};

export type BarcodeProductLookup =
  | { found: true; form: MealFormData; imageUrl: string | null; barcode: string }
  | { found: false; barcode: string };

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function roundMacro(value: number): number {
  return Math.max(0, Math.round(value));
}

function nutrient(
  nutriments: OffNutriments | undefined,
  key: string,
  preferServing: boolean
): number | null {
  if (!nutriments) return null;
  if (preferServing) {
    const serving = asNumber(nutriments[`${key}_serving`]);
    if (serving != null) return serving;
  }
  return asNumber(nutriments[`${key}_100g`]);
}

function caloriesFromNutriments(
  nutriments: OffNutriments | undefined,
  preferServing: boolean
): number | null {
  const kcal = nutrient(nutriments, "energy-kcal", preferServing);
  if (kcal != null) return kcal;
  const kj = nutrient(nutriments, "energy-kj", preferServing);
  if (kj != null) return kj / 4.184;
  const energy = nutrient(nutriments, "energy", preferServing);
  if (energy != null) {
    // OFF sometimes stores kJ under "energy"
    return energy > 1000 ? energy / 4.184 : energy;
  }
  return null;
}

function productDisplayName(product: OffProduct): string {
  const name =
    product.product_name?.trim() ||
    product.product_name_en?.trim() ||
    product.generic_name?.trim();
  if (name) return name;
  const brand = product.brands?.split(",")[0]?.trim();
  return brand || "Scanned product";
}

export function mealFormFromOpenFoodFactsProduct(
  product: OffProduct
): MealFormData | null {
  const nutriments = product.nutriments;
  const hasServing =
    nutrient(nutriments, "energy-kcal", true) != null ||
    nutrient(nutriments, "proteins", true) != null ||
    nutrient(nutriments, "carbohydrates", true) != null ||
    nutrient(nutriments, "fat", true) != null;

  const calories = caloriesFromNutriments(nutriments, hasServing);
  const protein = nutrient(nutriments, "proteins", hasServing);
  const carbs = nutrient(nutriments, "carbohydrates", hasServing);
  const fat = nutrient(nutriments, "fat", hasServing);

  if (calories == null && protein == null && carbs == null && fat == null) {
    return null;
  }

  const amount = hasServing
    ? product.serving_size?.trim() || "1 serving"
    : "100g";

  const name = productDisplayName(product);
  const brand = product.brands?.split(",")[0]?.trim();
  const descriptionParts = [
    brand && brand.toLowerCase() !== name.toLowerCase() ? brand : null,
    product.quantity?.trim() || null,
    hasServing ? null : "Macros per 100g",
  ].filter(Boolean);

  return {
    meal_type: "snack",
    name,
    description: descriptionParts.join(" · "),
    youtube_url: "",
    macros: {
      calories: roundMacro(calories ?? 0),
      protein: roundMacro(protein ?? 0),
      carbs: roundMacro(carbs ?? 0),
      fat: roundMacro(fat ?? 0),
    },
    ingredients: [{ name, amount }],
  };
}

export async function lookupOpenFoodFactsBarcode(
  barcode: string
): Promise<BarcodeProductLookup> {
  const cleaned = barcode.replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 14) {
    return { found: false, barcode: cleaned || barcode };
  }

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "RutinaAL/1.0 (meal barcode logging; https://rutina.al)",
      },
      next: { revalidate: 86400 },
    }
  );

  if (!response.ok) {
    return { found: false, barcode: cleaned };
  }

  const data = (await response.json()) as {
    status?: number;
    product?: OffProduct;
  };

  if (data.status !== 1 || !data.product) {
    return { found: false, barcode: cleaned };
  }

  const form = mealFormFromOpenFoodFactsProduct(data.product);
  if (!form) {
    return { found: false, barcode: cleaned };
  }

  return {
    found: true,
    form,
    barcode: cleaned,
    imageUrl:
      data.product.image_front_url?.trim() ||
      data.product.image_url?.trim() ||
      null,
  };
}
