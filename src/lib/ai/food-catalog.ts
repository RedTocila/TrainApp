/**
 * Structured food catalog for the nutrition coach: nutrition per 100 g,
 * processing level, allergen/diet tags, serving units, prep effort, cost.
 * Nutrient values come from USDA FoodData Central (see `food-reference.ts`,
 * with FDC ids); a few branded-style items use typical label values. Real food
 * varies, so numbers are reference values, not lab measurements. Pure — no I/O.
 */

import type { FoodCategoryId } from "@/lib/ai/nutrition-constraints";
import { FOOD_REFERENCE } from "@/lib/ai/food-reference";
import { FOOD_NAMES_SQ } from "@/lib/ai/food-names-sq";

export type ProcessingLevel = "whole" | "minimally_processed" | "processed" | "highly_processed";

export type FoodRole =
  | "protein"
  | "carb"
  | "fat"
  | "vegetable"
  | "fruit"
  | "mixed"
  | "condiment"
  | "beverage"
  | "treat";

export type FoodGroup =
  | "poultry"
  | "red_meat"
  | "pork"
  | "fish"
  | "seafood"
  | "eggs"
  | "dairy"
  | "plant_protein"
  | "legume"
  | "grain"
  | "bread"
  | "starchy_veg"
  | "vegetable"
  | "fruit"
  | "nut_seed"
  | "fat_oil"
  | "dairy_alt"
  | "condiment"
  | "seasoning"
  | "beverage"
  | "sweetener"
  | "snack"
  | "sweet"
  | "fast_food"
  | "supplement";

export type Nutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type FoodItem = {
  id: string;
  name: string;
  /** Lowercase phrases matched as whole words (English + common Albanian). */
  aliases: string[];
  group: FoodGroup;
  role: FoodRole;
  processing: ProcessingLevel;
  /** Per 100 g in the state named by `basis`. */
  per100: Nutrients;
  basis: "cooked" | "raw" | "dry" | "as_eaten";
  /** Per 100 g raw / dry, when the client or model says "raw" / "dry". */
  per100Raw?: Nutrients;
  /** Grams per unit: piece, slice, cup, tbsp, scoop, handful, can. */
  units: Partial<Record<"piece" | "slice" | "cup" | "tbsp" | "scoop" | "handful" | "can", number>>;
  /** How amounts are shown after recalculation. */
  display: "g" | "piece" | "tbsp" | "ml" | "slice";
  /** Label after a piece count ("3 large" eggs, "1 medium" banana). */
  pieceLabel?: string;
  /** g/ml for liquids. */
  density?: number;
  serving: number;
  maxPerMeal: number;
  tags: FoodCategoryId[];
  /** 0 = no prep, 1 = minimal (boil, microwave, toast), 2 = real cooking. */
  prep: 0 | 1 | 2;
  cost: 1 | 2 | 3;
  /** Easy to find in a normal supermarket. */
  common: boolean;
  /** Preferred substitution ids (checked first by the swap engine). */
  swaps?: string[];
  /** Where the nutrient values come from. */
  source: "usda" | "composite" | "label";
  /** USDA FoodData Central id for `per100` (when source is "usda"). */
  fdcId?: number;
  /** Albanian display name. */
  nameSq?: string;
};

type Opts = Partial<Omit<FoodItem, "id" | "name" | "aliases" | "group" | "role" | "processing" | "per100" | "source" | "fdcId" | "nameSq">>;

function n(v: readonly [number, number, number, number, number]): Nutrients {
  return { calories: v[0], protein: v[1], carbs: v[2], fat: v[3], fiber: v[4] };
}

function food(
  id: string,
  name: string,
  aliases: string[],
  group: FoodGroup,
  role: FoodRole,
  processing: ProcessingLevel,
  per100: readonly [number, number, number, number, number],
  opts: Opts & { raw?: readonly [number, number, number, number, number] } = {}
): FoodItem {
  const { raw, ...rest } = opts;
  const ref = FOOD_REFERENCE[id];
  const nameSq = FOOD_NAMES_SQ[id];
  return {
    id,
    name,
    aliases: [...new Set([name.toLowerCase(), ...aliases, ...(nameSq ? [nameSq.toLowerCase()] : [])])],
    group,
    role,
    processing,
    per100: n(ref?.per100 ?? per100),
    basis: rest.basis ?? "as_eaten",
    per100Raw: ref?.raw ? n(ref.raw.per100) : raw ? n(raw) : undefined,
    units: rest.units ?? {},
    display: rest.display ?? "g",
    pieceLabel: rest.pieceLabel,
    density: rest.density,
    serving: rest.serving ?? 100,
    maxPerMeal: rest.maxPerMeal ?? 400,
    tags: rest.tags ?? [],
    prep: rest.prep ?? 1,
    cost: rest.cost ?? 2,
    common: rest.common ?? true,
    swaps: rest.swaps,
    source: ref?.source ?? "label",
    fdcId: ref?.fdcId,
    nameSq,
  };
}

const W = "whole";
const M = "minimally_processed";
const P = "processed";
const H = "highly_processed";

export const FOOD_CATALOG: FoodItem[] = [
  // ─── Poultry / meat / fish (cooked weights) ──────────────────────────────
  food("chicken_breast", "chicken breast", ["chicken", "chicken fillet", "chicken breasts", "mish pule", "gjoks pule", "pule"], "poultry", "protein", W, [165, 31, 0, 3.6, 0], {
    basis: "cooked", raw: [120, 22.5, 0, 2.6, 0], serving: 150, maxPerMeal: 300, tags: ["chicken"], prep: 2, cost: 2,
    swaps: ["turkey_breast", "lean_beef", "white_fish", "eggs", "tofu"],
  }),
  food("chicken_thigh", "chicken thigh", ["chicken thighs", "kofshe pule"], "poultry", "protein", W, [209, 26, 0, 10.9, 0], {
    basis: "cooked", raw: [121, 19.7, 0, 4.1, 0], serving: 150, maxPerMeal: 300, tags: ["chicken"], prep: 2, cost: 1,
    swaps: ["turkey_mince", "beef_mince", "pork_loin", "salmon"],
  }),
  food("turkey_breast", "turkey breast", ["turkey", "turkey fillet", "gjel deti"], "poultry", "protein", W, [135, 30, 0, 1.5, 0], {
    basis: "cooked", raw: [114, 23.7, 0, 1.5, 0], serving: 150, maxPerMeal: 300, tags: ["poultry"], prep: 2, cost: 2,
    swaps: ["chicken_breast", "lean_beef", "white_fish", "eggs"],
  }),
  food("turkey_mince", "lean turkey mince", ["ground turkey", "turkey mince", "minced turkey"], "poultry", "protein", M, [170, 23, 0, 8, 0], {
    basis: "cooked", raw: [150, 19, 0, 8, 0], serving: 150, maxPerMeal: 300, tags: ["poultry"], prep: 2, cost: 2,
    swaps: ["beef_mince", "chicken_breast", "lentils"],
  }),
  food("lean_beef", "lean beef", ["beef", "sirloin", "steak", "sirloin steak", "beef steak", "rump steak", "mish vici", "biftek"], "red_meat", "protein", W, [190, 28, 0, 8.5, 0], {
    basis: "cooked", raw: [140, 21, 0, 6, 0], serving: 150, maxPerMeal: 300, tags: ["red_meat"], prep: 2, cost: 3,
    swaps: ["beef_mince", "turkey_breast", "chicken_breast", "pork_loin"],
  }),
  food("beef_mince", "lean beef mince", ["ground beef", "beef mince", "minced beef", "lean ground beef", "mince", "mish i grire"], "red_meat", "protein", M, [217, 26, 0, 12, 0], {
    basis: "cooked", raw: [176, 20, 0, 10, 0], serving: 150, maxPerMeal: 300, tags: ["red_meat"], prep: 2, cost: 2,
    swaps: ["turkey_mince", "lean_beef", "lentils"],
  }),
  food("lamb", "lean lamb", ["lamb", "lamb leg", "mish qengji", "qengj"], "red_meat", "protein", W, [206, 28, 0, 9.5, 0], {
    basis: "cooked", serving: 150, maxPerMeal: 250, tags: ["red_meat"], prep: 2, cost: 3, swaps: ["lean_beef", "beef_mince"],
  }),
  food("pork_loin", "pork tenderloin", ["pork", "pork loin", "pork chop", "pork chops", "mish derri"], "pork", "protein", W, [143, 26, 0, 3.5, 0], {
    basis: "cooked", serving: 150, maxPerMeal: 300, tags: ["pork"], prep: 2, cost: 2, swaps: ["chicken_breast", "turkey_breast", "lean_beef"],
  }),
  food("salmon", "salmon", ["salmon fillet", "salmon fillets", "salmon steak", "salmon filet", "salmone"], "fish", "protein", W, [206, 22, 0, 12.4, 0], {
    basis: "cooked", raw: [208, 20, 0, 13, 0], serving: 150, maxPerMeal: 250, tags: ["fish"], prep: 2, cost: 3,
    swaps: ["trout", "sardines", "white_fish", "chicken_thigh"],
  }),
  food("trout", "trout", ["trout fillet", "troft", "trofte"], "fish", "protein", W, [190, 26.6, 0, 8.5, 0], {
    basis: "cooked", serving: 150, maxPerMeal: 250, tags: ["fish"], prep: 2, cost: 2, swaps: ["salmon", "white_fish"],
  }),
  food("white_fish", "white fish", ["fish", "cod", "cod fillet", "tilapia", "hake", "pollock", "haddock", "sea bass", "seabass", "white fish fillet", "peshk", "levrek", "koce"], "fish", "protein", W, [110, 24, 0, 1.5, 0], {
    basis: "cooked", raw: [82, 18, 0, 0.7, 0], serving: 170, maxPerMeal: 300, tags: ["fish"], prep: 2, cost: 2,
    swaps: ["chicken_breast", "turkey_breast", "shrimp", "tuna"],
  }),
  food("tuna", "tuna (canned in water)", ["tuna", "canned tuna", "tinned tuna", "tuna in water", "ton"], "fish", "protein", M, [116, 26, 0, 0.8, 0], {
    serving: 120, maxPerMeal: 200, tags: ["fish"], prep: 0, cost: 2, units: { can: 112 },
    swaps: ["chicken_breast", "turkey_breast", "eggs", "chickpeas"],
  }),
  food("sardines", "sardines", ["sardine", "canned sardines", "sardele"], "fish", "protein", M, [208, 25, 0, 11.5, 0], {
    serving: 100, maxPerMeal: 200, tags: ["fish"], prep: 0, cost: 1, units: { can: 90 }, swaps: ["salmon", "tuna", "eggs"],
  }),
  food("shrimp", "shrimp", ["prawns", "prawn", "karkaleca"], "seafood", "protein", W, [99, 24, 0.2, 0.3, 0], {
    basis: "cooked", serving: 150, maxPerMeal: 250, tags: ["shellfish"], prep: 1, cost: 3, swaps: ["white_fish", "chicken_breast"],
  }),

  // ─── Eggs & dairy ────────────────────────────────────────────────────────
  food("eggs", "eggs", ["egg", "whole egg", "whole eggs", "scrambled eggs", "boiled eggs", "omelette", "omelet", "veze", "veza"], "eggs", "protein", W, [143, 12.6, 0.7, 9.5, 0], {
    units: { piece: 50 }, display: "piece", pieceLabel: "large", serving: 150, maxPerMeal: 250, tags: ["eggs"], prep: 1, cost: 1,
    swaps: ["greek_yogurt", "cottage_cheese", "tofu", "turkey_breast"],
  }),
  food("egg_whites", "egg whites", ["egg white", "liquid egg whites", "te bardhe veze"], "eggs", "protein", M, [52, 11, 0.7, 0.2, 0], {
    units: { tbsp: 15, cup: 243 }, serving: 150, maxPerMeal: 300, tags: ["eggs"], prep: 1, cost: 2, swaps: ["eggs", "greek_yogurt", "tofu"],
  }),
  food("greek_yogurt", "plain Greek yogurt", ["greek yogurt", "greek yoghurt", "plain greek yogurt", "low fat greek yogurt", "skyr", "kos grek", "jogurt grek"], "dairy", "protein", M, [73, 10, 4, 2, 0], {
    units: { cup: 245, tbsp: 15 }, serving: 170, maxPerMeal: 350, tags: ["dairy"], prep: 0, cost: 2,
    swaps: ["cottage_cheese", "yogurt", "soy_yogurt", "eggs"],
  }),
  food("yogurt", "plain yogurt", ["yogurt", "yoghurt", "natural yogurt", "plain yoghurt", "kos", "jogurt"], "dairy", "mixed", M, [61, 3.5, 4.7, 3.3, 0], {
    units: { cup: 245, tbsp: 15 }, serving: 200, maxPerMeal: 350, tags: ["dairy"], prep: 0, cost: 1, swaps: ["greek_yogurt", "soy_yogurt"],
  }),
  food("cottage_cheese", "cottage cheese", ["low fat cottage cheese", "gjize"], "dairy", "protein", M, [84, 11, 4.3, 2.3, 0], {
    units: { cup: 226, tbsp: 15 }, serving: 150, maxPerMeal: 300, tags: ["dairy"], prep: 0, cost: 2, swaps: ["greek_yogurt", "eggs", "tofu"],
  }),
  food("milk", "milk", ["semi skimmed milk", "2% milk", "low fat milk", "whole milk", "skim milk", "skimmed milk", "cow's milk", "qumesht"], "dairy", "mixed", M, [50, 3.3, 4.8, 2, 0], {
    units: { cup: 250 }, display: "ml", density: 1.03, serving: 250, maxPerMeal: 500, tags: ["dairy"], prep: 0, cost: 1,
    swaps: ["soy_milk", "oat_milk"],
  }),
  food("cheese", "cheese", ["cheddar", "cheddar cheese", "hard cheese", "grated cheese", "djathe", "kashkaval"], "dairy", "fat", P, [403, 25, 1.3, 33, 0], {
    units: { slice: 20, tbsp: 7 }, serving: 30, maxPerMeal: 60, tags: ["dairy"], prep: 0, cost: 2, swaps: ["feta", "mozzarella", "avocado"],
  }),
  food("feta", "feta", ["feta cheese", "djathe i bardhe", "white cheese"], "dairy", "fat", P, [264, 14, 4, 21, 0], {
    serving: 30, maxPerMeal: 80, tags: ["dairy"], prep: 0, cost: 2, swaps: ["cheese", "avocado", "olives"],
  }),
  food("mozzarella", "mozzarella", ["mozzarella cheese", "light mozzarella"], "dairy", "protein", P, [254, 24, 3, 16, 0], {
    serving: 60, maxPerMeal: 125, tags: ["dairy"], prep: 0, cost: 2, swaps: ["feta", "cottage_cheese"],
  }),

  // ─── Plant proteins & legumes (cooked / drained) ────────────────────────
  food("tofu", "firm tofu", ["tofu", "firm tofu", "extra firm tofu", "tofu scramble"], "plant_protein", "protein", M, [144, 17.3, 2.8, 8.7, 2.3], {
    serving: 150, maxPerMeal: 300, tags: ["soy"], prep: 1, cost: 2, swaps: ["tempeh", "lentils", "chickpeas", "eggs"],
  }),
  food("tempeh", "tempeh", [], "plant_protein", "protein", M, [192, 20, 7.6, 11, 5], {
    serving: 120, maxPerMeal: 250, tags: ["soy"], prep: 1, cost: 3, common: false, swaps: ["tofu", "lentils"],
  }),
  food("edamame", "edamame", ["edamame beans"], "plant_protein", "protein", W, [121, 12, 9, 5, 5], {
    serving: 120, maxPerMeal: 250, tags: ["soy"], prep: 1, cost: 2, swaps: ["green_peas", "chickpeas"],
  }),
  food("lentils", "lentils", ["cooked lentils", "red lentils", "green lentils", "brown lentils", "lentil", "thjerreza"], "legume", "protein", M, [116, 9, 20, 0.4, 7.9], {
    basis: "cooked", raw: [352, 24.6, 63, 1.1, 10.7], units: { cup: 198, can: 240 }, serving: 180, maxPerMeal: 350, prep: 1, cost: 1,
    swaps: ["chickpeas", "black_beans", "kidney_beans", "tofu"],
  }),
  food("chickpeas", "chickpeas", ["chickpea", "garbanzo beans", "canned chickpeas", "qiqra"], "legume", "protein", M, [164, 8.9, 27.4, 2.6, 7.6], {
    basis: "cooked", units: { cup: 164, can: 240 }, serving: 150, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["lentils", "black_beans", "kidney_beans"],
  }),
  food("black_beans", "black beans", ["black bean", "canned black beans"], "legume", "protein", M, [132, 8.9, 23.7, 0.5, 8.7], {
    basis: "cooked", units: { cup: 172, can: 240 }, serving: 150, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["kidney_beans", "lentils", "chickpeas"],
  }),
  food("kidney_beans", "kidney beans", ["beans", "red beans", "white beans", "cannellini beans", "canned beans", "fasule", "bishtaja"], "legume", "protein", M, [127, 8.7, 22.8, 0.5, 6.4], {
    basis: "cooked", units: { cup: 177, can: 240 }, serving: 150, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["black_beans", "lentils", "chickpeas"],
  }),

  // ─── Grains & starches ───────────────────────────────────────────────────
  food("white_rice", "rice", ["white rice", "basmati rice", "jasmine rice", "cooked rice", "boiled rice", "rice (cooked)", "oriz"], "grain", "carb", M, [130, 2.7, 28.2, 0.3, 0.4], {
    basis: "cooked", raw: [365, 7.1, 80, 0.7, 1.3], units: { cup: 158 }, serving: 200, maxPerMeal: 400, prep: 1, cost: 1,
    swaps: ["brown_rice", "potatoes", "quinoa", "sweet_potato"],
  }),
  food("brown_rice", "brown rice", ["wholegrain rice", "whole grain rice", "oriz integral"], "grain", "carb", M, [123, 2.7, 25.6, 1, 1.6], {
    basis: "cooked", raw: [367, 7.5, 76, 3.2, 3.4], units: { cup: 195 }, serving: 200, maxPerMeal: 400, prep: 1, cost: 1,
    swaps: ["white_rice", "quinoa", "potatoes"],
  }),
  food("oats", "oats", ["rolled oats", "porridge oats", "oatmeal", "porridge", "oat flakes", "tershere", "gluten free oats", "gluten-free oats"], "grain", "carb", M, [379, 13.2, 67.7, 6.5, 10.1], {
    basis: "dry", units: { cup: 80, tbsp: 5 }, serving: 60, maxPerMeal: 120, prep: 1, cost: 1,
    swaps: ["wholegrain_bread", "potatoes", "white_rice"],
  }),
  food("potatoes", "potatoes", ["potato", "boiled potatoes", "baked potato", "new potatoes", "roast potatoes", "mashed potatoes", "patate", "pataten"], "starchy_veg", "carb", W, [90, 2.2, 20.5, 0.1, 2], {
    basis: "cooked", raw: [77, 2, 17.5, 0.1, 2.2], units: { piece: 170 }, serving: 250, maxPerMeal: 450, prep: 1, cost: 1,
    swaps: ["sweet_potato", "white_rice", "brown_rice"],
  }),
  food("sweet_potato", "sweet potato", ["sweet potatoes", "yam", "patate e embel", "batate"], "starchy_veg", "carb", W, [90, 2, 20.7, 0.2, 3.3], {
    basis: "cooked", units: { piece: 150 }, serving: 250, maxPerMeal: 450, prep: 1, cost: 2, swaps: ["potatoes", "brown_rice"],
  }),
  food("quinoa", "quinoa", ["cooked quinoa", "kinoa"], "grain", "carb", M, [120, 4.4, 21.3, 1.9, 2.8], {
    basis: "cooked", units: { cup: 185 }, serving: 180, maxPerMeal: 350, prep: 1, cost: 3, swaps: ["brown_rice", "white_rice", "bulgur"],
  }),
  food("pasta", "pasta", ["spaghetti", "penne", "fusilli", "macaroni", "cooked pasta", "makarona", "shpageti"], "grain", "carb", P, [158, 5.8, 30.9, 0.9, 1.8], {
    basis: "cooked", raw: [371, 13, 75, 1.5, 3.2], units: { cup: 140 }, serving: 200, maxPerMeal: 400, tags: ["gluten"], prep: 1, cost: 1,
    swaps: ["wholewheat_pasta", "white_rice", "potatoes"],
  }),
  food("wholewheat_pasta", "whole-wheat pasta", ["wholewheat pasta", "whole wheat pasta", "wholegrain pasta", "whole grain pasta"], "grain", "carb", P, [149, 6, 30, 1.5, 4], {
    basis: "cooked", raw: [352, 14, 71, 2.5, 9], units: { cup: 140 }, serving: 200, maxPerMeal: 400, tags: ["gluten"], prep: 1, cost: 1,
    swaps: ["brown_rice", "potatoes", "quinoa"],
  }),
  food("bulgur", "bulgur", ["bulgur wheat", "bulgur"], "grain", "carb", M, [83, 3.1, 18.6, 0.2, 4.5], {
    basis: "cooked", units: { cup: 182 }, serving: 180, maxPerMeal: 350, tags: ["gluten"], prep: 1, cost: 1, swaps: ["quinoa", "brown_rice"],
  }),
  food("couscous", "couscous", [], "grain", "carb", P, [112, 3.8, 23.2, 0.2, 1.4], {
    basis: "cooked", units: { cup: 157 }, serving: 180, maxPerMeal: 350, tags: ["gluten"], prep: 1, cost: 1, swaps: ["quinoa", "white_rice"],
  }),
  food("wholegrain_bread", "whole-grain bread", ["wholegrain bread", "whole grain bread", "wholemeal bread", "whole wheat bread", "whole-wheat bread", "rye bread", "sourdough", "sourdough bread", "bread", "toast", "buke", "buke integrale"], "bread", "carb", P, [250, 12, 43, 3.5, 7], {
    units: { slice: 35 }, display: "slice", serving: 70, maxPerMeal: 140, tags: ["gluten"], prep: 0, cost: 1,
    swaps: ["oats", "potatoes", "corn_tortilla"],
  }),
  food("white_bread", "white bread", ["white toast", "baguette", "buke e bardhe"], "bread", "carb", P, [265, 9, 49, 3.2, 2.7], {
    units: { slice: 30 }, display: "slice", serving: 60, maxPerMeal: 120, tags: ["gluten"], prep: 0, cost: 1, swaps: ["wholegrain_bread", "oats"],
  }),
  food("gf_bread", "gluten-free bread", ["gluten free bread"], "bread", "carb", P, [250, 4, 45, 6, 5], {
    units: { slice: 35 }, display: "slice", serving: 70, maxPerMeal: 140, prep: 0, cost: 2, swaps: ["potatoes", "white_rice"],
  }),
  food("wholewheat_wrap", "whole-wheat wrap", ["wrap", "tortilla wrap", "flour tortilla", "tortilla", "wholewheat wrap", "whole wheat wrap", "pita", "pita bread"], "bread", "carb", P, [300, 9, 48, 8, 6], {
    units: { piece: 60 }, display: "piece", serving: 60, maxPerMeal: 120, tags: ["gluten"], prep: 0, cost: 1, swaps: ["corn_tortilla", "wholegrain_bread"],
  }),
  food("corn_tortilla", "corn tortillas", ["corn tortilla"], "bread", "carb", P, [218, 5.7, 44.6, 2.9, 6.3], {
    units: { piece: 26 }, display: "piece", serving: 52, maxPerMeal: 104, prep: 0, cost: 1, swaps: ["potatoes", "white_rice"],
  }),
  food("rice_cakes", "rice cakes", ["rice cake"], "grain", "carb", P, [387, 8, 81, 2.8, 4], {
    units: { piece: 9 }, display: "piece", serving: 18, maxPerMeal: 45, prep: 0, cost: 1, swaps: ["oats", "wholegrain_bread"],
  }),
  food("buckwheat", "buckwheat", ["buckwheat groats", "kasha"], "grain", "carb", M, [92, 3.4, 20, 0.6, 2.7], {
    basis: "cooked", serving: 180, maxPerMeal: 350, prep: 1, cost: 2, common: false, swaps: ["quinoa", "brown_rice"],
  }),
  food("corn", "sweetcorn", ["corn", "sweet corn", "corn kernels", "misër", "miser"], "starchy_veg", "carb", M, [96, 3.4, 21, 1.5, 2.4], {
    units: { cup: 150, can: 200 }, serving: 80, maxPerMeal: 200, prep: 0, cost: 1, swaps: ["green_peas", "potatoes"],
  }),
  food("rice_noodles", "rice noodles", ["rice noodle"], "grain", "carb", P, [108, 1.8, 24, 0.2, 1], {
    basis: "cooked", serving: 180, maxPerMeal: 350, prep: 1, cost: 2, swaps: ["white_rice"],
  }),
  food("muesli", "muesli (no added sugar)", ["muesli", "unsweetened muesli"], "grain", "carb", P, [360, 10, 66, 6, 8], {
    units: { cup: 85 }, serving: 50, maxPerMeal: 100, tags: ["gluten"], prep: 0, cost: 2, swaps: ["oats"],
  }),

  // ─── Fruit ───────────────────────────────────────────────────────────────
  food("banana", "banana", ["bananas", "banane"], "fruit", "fruit", W, [89, 1.1, 22.8, 0.3, 2.6], {
    units: { piece: 118 }, display: "piece", pieceLabel: "medium", serving: 118, maxPerMeal: 240, prep: 0, cost: 1, swaps: ["apple", "orange", "berries"],
  }),
  food("apple", "apple", ["apples", "molle", "molla"], "fruit", "fruit", W, [52, 0.3, 13.8, 0.2, 2.4], {
    units: { piece: 180 }, display: "piece", pieceLabel: "medium", serving: 180, maxPerMeal: 360, prep: 0, cost: 1, swaps: ["pear", "orange", "banana"],
  }),
  food("orange", "orange", ["oranges", "portokall", "mandarin", "clementine"], "fruit", "fruit", W, [47, 0.9, 11.8, 0.1, 2.4], {
    units: { piece: 130 }, display: "piece", pieceLabel: "medium", serving: 130, maxPerMeal: 260, prep: 0, cost: 1, swaps: ["apple", "kiwi", "berries"],
  }),
  food("pear", "pear", ["pears", "dardhe", "dardha"], "fruit", "fruit", W, [57, 0.4, 15.2, 0.1, 3.1], {
    units: { piece: 178 }, display: "piece", pieceLabel: "medium", serving: 178, maxPerMeal: 356, prep: 0, cost: 1, swaps: ["apple", "orange"],
  }),
  food("berries", "mixed berries", ["berries", "berry", "blueberries", "blueberry", "strawberries", "strawberry", "raspberries", "raspberry", "frozen berries", "fruta pylli", "luleshtrydhe"], "fruit", "fruit", W, [45, 0.8, 10.5, 0.4, 3.5], {
    units: { cup: 145, handful: 50 }, serving: 120, maxPerMeal: 250, prep: 0, cost: 2, swaps: ["banana", "apple", "kiwi"],
  }),
  food("kiwi", "kiwi", ["kiwis", "kiwifruit"], "fruit", "fruit", W, [61, 1.1, 14.7, 0.5, 3], {
    units: { piece: 75 }, display: "piece", serving: 150, maxPerMeal: 225, prep: 0, cost: 2, swaps: ["orange", "berries"],
  }),
  food("grapes", "grapes", ["grape", "rrush"], "fruit", "fruit", W, [69, 0.7, 18, 0.2, 0.9], {
    units: { cup: 150, handful: 50 }, serving: 120, maxPerMeal: 250, prep: 0, cost: 2, swaps: ["berries", "apple"],
  }),
  food("mango", "mango", ["mangoes"], "fruit", "fruit", W, [60, 0.8, 15, 0.4, 1.6], {
    units: { cup: 165 }, serving: 150, maxPerMeal: 250, prep: 0, cost: 2, swaps: ["banana", "peach"],
  }),
  food("peach", "peach", ["peaches", "nectarine", "pjeshke"], "fruit", "fruit", W, [39, 0.9, 9.5, 0.3, 1.5], {
    units: { piece: 150 }, display: "piece", pieceLabel: "medium", serving: 150, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["apple", "pear"],
  }),
  food("pineapple", "pineapple", ["ananas"], "fruit", "fruit", W, [50, 0.5, 13.1, 0.1, 1.4], {
    units: { cup: 165 }, serving: 150, maxPerMeal: 250, prep: 0, cost: 2, swaps: ["mango", "orange"],
  }),
  food("watermelon", "watermelon", ["shalqi"], "fruit", "fruit", W, [30, 0.6, 7.6, 0.2, 0.4], {
    units: { cup: 152 }, serving: 250, maxPerMeal: 400, prep: 0, cost: 1, swaps: ["berries", "orange"],
  }),
  food("dates", "dates", ["date", "medjool dates", "hurma"], "fruit", "fruit", M, [282, 2.5, 75, 0.4, 8], {
    units: { piece: 8 }, display: "piece", serving: 24, maxPerMeal: 60, prep: 0, cost: 2, swaps: ["banana", "raisins"],
  }),
  food("raisins", "raisins", ["rrush i thate"], "fruit", "fruit", M, [299, 3.1, 79, 0.5, 3.7], {
    units: { tbsp: 10, handful: 30 }, serving: 30, maxPerMeal: 50, prep: 0, cost: 1, swaps: ["dates", "banana"],
  }),
  food("plum", "plums", ["plum", "kumbulla"], "fruit", "fruit", W, [46, 0.7, 11.4, 0.3, 1.4], {
    units: { piece: 66 }, display: "piece", serving: 132, maxPerMeal: 264, prep: 0, cost: 1, swaps: ["peach", "apple"],
  }),
  food("orange_juice", "orange juice", ["fruit juice", "juice", "apple juice", "leng portokalli", "leng frutash"], "beverage", "beverage", P, [45, 0.7, 10.4, 0.2, 0.2], {
    units: { cup: 250 }, display: "ml", density: 1.04, serving: 250, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["orange", "apple"],
  }),

  // ─── Vegetables ──────────────────────────────────────────────────────────
  food("mixed_vegetables", "mixed vegetables", ["vegetables", "veg", "veggies", "steamed vegetables", "roasted vegetables", "stir fry vegetables", "stir-fry vegetables", "frozen vegetables", "seasonal vegetables", "perime", "perime te ziera"], "vegetable", "vegetable", W, [40, 2, 7, 0.3, 3], {
    units: { cup: 150 }, serving: 150, maxPerMeal: 350, prep: 1, cost: 1, swaps: ["broccoli", "green_beans", "salad"],
  }),
  food("salad", "mixed salad", ["salad", "side salad", "green salad", "salad greens", "mixed greens", "leafy greens", "lettuce", "rocket", "arugula", "sallate", "marule"], "vegetable", "vegetable", W, [17, 1.4, 3.3, 0.2, 2.1], {
    units: { cup: 50, handful: 30 }, serving: 100, maxPerMeal: 250, prep: 0, cost: 1, swaps: ["cucumber", "tomato", "mixed_vegetables"],
  }),
  food("broccoli", "broccoli", ["broccoli florets", "brokoli"], "vegetable", "vegetable", W, [35, 2.4, 7.2, 0.4, 3.3], {
    units: { cup: 90 }, serving: 150, maxPerMeal: 300, prep: 1, cost: 1, swaps: ["green_beans", "cauliflower", "mixed_vegetables"],
  }),
  food("spinach", "spinach", ["baby spinach", "spinaq"], "vegetable", "vegetable", W, [23, 2.9, 3.6, 0.4, 2.2], {
    units: { cup: 30, handful: 30 }, serving: 80, maxPerMeal: 200, prep: 0, cost: 1, swaps: ["kale", "salad"],
  }),
  food("bell_pepper", "bell pepper", ["bell peppers", "peppers", "pepper", "red pepper", "green pepper", "piper", "speca", "spec"], "vegetable", "vegetable", W, [31, 1, 6, 0.3, 2.1], {
    units: { piece: 120 }, serving: 120, maxPerMeal: 250, prep: 0, cost: 1, swaps: ["tomato", "carrot"],
  }),
  food("tomato", "tomatoes", ["tomato", "cherry tomatoes", "domate", "domatja"], "vegetable", "vegetable", W, [18, 0.9, 3.9, 0.2, 1.2], {
    units: { piece: 120 }, serving: 120, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["bell_pepper", "cucumber"],
  }),
  food("cucumber", "cucumber", ["cucumbers", "kastravec", "tranguj"], "vegetable", "vegetable", W, [15, 0.7, 3.6, 0.1, 0.5], {
    units: { piece: 300 }, serving: 100, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["tomato", "salad"],
  }),
  food("carrot", "carrots", ["carrot", "baby carrots", "karrota"], "vegetable", "vegetable", W, [41, 0.9, 9.6, 0.2, 2.8], {
    units: { piece: 60 }, serving: 100, maxPerMeal: 250, prep: 0, cost: 1, swaps: ["bell_pepper", "cucumber"],
  }),
  food("zucchini", "zucchini", ["courgette", "courgettes", "kungull"], "vegetable", "vegetable", W, [17, 1.2, 3.1, 0.3, 1], {
    units: { piece: 200 }, serving: 150, maxPerMeal: 300, prep: 1, cost: 1, swaps: ["eggplant", "broccoli"],
  }),
  food("green_beans", "green beans", ["string beans", "fasule jeshile"], "vegetable", "vegetable", W, [31, 1.8, 7, 0.1, 2.7], {
    units: { cup: 110 }, serving: 150, maxPerMeal: 300, prep: 1, cost: 1, swaps: ["broccoli", "asparagus"],
  }),
  food("green_peas", "green peas", ["peas", "garden peas", "frozen peas", "bizele"], "vegetable", "vegetable", W, [81, 5.4, 14.5, 0.4, 5.1], {
    units: { cup: 145 }, serving: 100, maxPerMeal: 250, prep: 1, cost: 1, swaps: ["green_beans", "corn"],
  }),
  food("cauliflower", "cauliflower", ["lulelakra"], "vegetable", "vegetable", W, [25, 1.9, 5, 0.3, 2], {
    units: { cup: 100 }, serving: 150, maxPerMeal: 300, prep: 1, cost: 1, swaps: ["broccoli", "zucchini"],
  }),
  food("mushrooms", "mushrooms", ["mushroom", "kerpudha"], "vegetable", "vegetable", W, [22, 3.1, 3.3, 0.3, 1], {
    units: { cup: 70 }, serving: 100, maxPerMeal: 250, prep: 1, cost: 2, swaps: ["zucchini", "bell_pepper"],
  }),
  food("onion", "onion", ["onions", "red onion", "qepe"], "vegetable", "vegetable", W, [40, 1.1, 9.3, 0.1, 1.7], {
    units: { piece: 110 }, serving: 50, maxPerMeal: 150, prep: 0, cost: 1, swaps: ["bell_pepper"],
  }),
  food("asparagus", "asparagus", ["shparg"], "vegetable", "vegetable", W, [20, 2.2, 3.9, 0.1, 2.1], {
    serving: 150, maxPerMeal: 300, prep: 1, cost: 3, swaps: ["green_beans", "broccoli"],
  }),
  food("cabbage", "cabbage", ["red cabbage", "coleslaw mix", "lakra"], "vegetable", "vegetable", W, [25, 1.3, 5.8, 0.1, 2.5], {
    units: { cup: 90 }, serving: 120, maxPerMeal: 300, prep: 0, cost: 1, swaps: ["salad", "broccoli"],
  }),
  food("kale", "kale", [], "vegetable", "vegetable", W, [35, 2.9, 4.4, 1.5, 4.1], {
    units: { cup: 20 }, serving: 60, maxPerMeal: 200, prep: 0, cost: 2, common: false, swaps: ["spinach", "broccoli"],
  }),
  food("eggplant", "eggplant", ["aubergine", "patellxhan"], "vegetable", "vegetable", W, [25, 1, 5.9, 0.2, 3], {
    serving: 150, maxPerMeal: 300, prep: 2, cost: 1, swaps: ["zucchini", "mushrooms"],
  }),
  food("beetroot", "beetroot", ["beets", "beet", "panxhar"], "vegetable", "vegetable", W, [43, 1.6, 9.6, 0.2, 2.8], {
    serving: 100, maxPerMeal: 250, prep: 1, cost: 1, swaps: ["carrot"],
  }),
  food("tomato_sauce", "tomato passata", ["passata", "tomato sauce", "crushed tomatoes", "canned tomatoes", "salce domate"], "vegetable", "vegetable", P, [29, 1.4, 5.5, 0.2, 1.5], {
    units: { cup: 245, tbsp: 16 }, serving: 100, maxPerMeal: 250, prep: 0, cost: 1, swaps: ["tomato"],
  }),

  // ─── Fats, nuts, seeds ───────────────────────────────────────────────────
  food("olive_oil", "olive oil", ["extra virgin olive oil", "evoo", "vaj ulliri"], "fat_oil", "fat", M, [884, 0, 0, 100, 0], {
    units: { tbsp: 13.5 }, display: "tbsp", density: 0.92, serving: 10, maxPerMeal: 30, prep: 0, cost: 2, swaps: ["avocado", "nuts_mixed"],
  }),
  food("vegetable_oil", "vegetable oil", ["oil", "sunflower oil", "canola oil", "rapeseed oil", "cooking oil", "vaj"], "fat_oil", "fat", P, [884, 0, 0, 100, 0], {
    units: { tbsp: 13.5 }, display: "tbsp", density: 0.92, serving: 10, maxPerMeal: 30, prep: 0, cost: 1, swaps: ["olive_oil"],
  }),
  food("butter", "butter", ["gjalpe"], "dairy", "fat", P, [717, 0.9, 0.1, 81, 0], {
    units: { tbsp: 14 }, display: "tbsp", serving: 10, maxPerMeal: 20, tags: ["dairy"], prep: 0, cost: 2, swaps: ["olive_oil"],
  }),
  food("avocado", "avocado", ["avocados", "half avocado", "avokado"], "fat_oil", "fat", W, [160, 2, 8.5, 14.7, 6.7], {
    units: { piece: 150 }, display: "piece", serving: 75, maxPerMeal: 150, prep: 0, cost: 2, swaps: ["olive_oil", "nuts_mixed"],
  }),
  food("olives", "olives", ["olive", "ullinj", "ulli"], "fat_oil", "fat", M, [115, 0.8, 6, 10.7, 3.2], {
    units: { handful: 30, piece: 4 }, serving: 30, maxPerMeal: 60, prep: 0, cost: 2, swaps: ["avocado", "olive_oil"],
  }),
  food("almonds", "almonds", ["almond", "bajame"], "nut_seed", "fat", W, [579, 21, 21.6, 49.9, 12.5], {
    units: { handful: 28, tbsp: 9 }, serving: 25, maxPerMeal: 50, tags: ["nuts"], prep: 0, cost: 2, swaps: ["walnuts", "pumpkin_seeds", "nuts_mixed"],
  }),
  food("walnuts", "walnuts", ["walnut", "arra", "arre"], "nut_seed", "fat", W, [654, 15.2, 13.7, 65.2, 6.7], {
    units: { handful: 28, tbsp: 8 }, serving: 25, maxPerMeal: 50, tags: ["nuts"], prep: 0, cost: 2, swaps: ["almonds", "pumpkin_seeds"],
  }),
  food("nuts_mixed", "mixed nuts", ["nuts", "unsalted nuts", "handful of nuts", "fruta te thata"], "nut_seed", "fat", W, [607, 20, 21, 54, 7], {
    units: { handful: 28, tbsp: 9 }, serving: 25, maxPerMeal: 50, tags: ["nuts", "peanuts"], prep: 0, cost: 2, swaps: ["pumpkin_seeds", "sunflower_seeds"],
  }),
  food("cashews", "cashews", ["cashew", "shqeme"], "nut_seed", "fat", W, [553, 18, 30, 44, 3.3], {
    units: { handful: 28 }, serving: 25, maxPerMeal: 50, tags: ["nuts"], prep: 0, cost: 3, swaps: ["almonds", "pumpkin_seeds"],
  }),
  food("peanuts", "peanuts", ["peanut", "kikirike"], "nut_seed", "fat", W, [567, 25.8, 16, 49, 8.5], {
    units: { handful: 28 }, serving: 25, maxPerMeal: 50, tags: ["peanuts"], prep: 0, cost: 1, swaps: ["pumpkin_seeds", "almonds"],
  }),
  food("peanut_butter", "natural peanut butter", ["peanut butter", "100% peanut butter", "gjalpe kikirike"], "nut_seed", "fat", M, [588, 25, 20, 50, 6], {
    units: { tbsp: 16 }, display: "tbsp", serving: 16, maxPerMeal: 40, tags: ["peanuts"], prep: 0, cost: 1, swaps: ["almond_butter", "sunflower_seed_butter"],
  }),
  food("almond_butter", "almond butter", [], "nut_seed", "fat", M, [614, 21, 19, 56, 10], {
    units: { tbsp: 16 }, display: "tbsp", serving: 16, maxPerMeal: 40, tags: ["nuts"], prep: 0, cost: 3, swaps: ["peanut_butter", "sunflower_seed_butter"],
  }),
  food("sunflower_seed_butter", "sunflower seed butter", ["sunbutter"], "nut_seed", "fat", M, [617, 17, 23, 55, 6], {
    units: { tbsp: 16 }, display: "tbsp", serving: 16, maxPerMeal: 40, prep: 0, cost: 3, common: false, swaps: ["tahini"],
  }),
  food("tahini", "tahini", ["sesame paste", "tahin"], "nut_seed", "fat", M, [595, 17, 21, 54, 9.3], {
    units: { tbsp: 15 }, display: "tbsp", serving: 15, maxPerMeal: 30, prep: 0, cost: 2, swaps: ["olive_oil", "sunflower_seed_butter"],
  }),
  food("chia_seeds", "chia seeds", ["chia", "fara chia"], "nut_seed", "fat", W, [486, 16.5, 42, 30.7, 34.4], {
    units: { tbsp: 12 }, display: "tbsp", serving: 12, maxPerMeal: 30, prep: 0, cost: 2, swaps: ["flaxseed", "pumpkin_seeds"],
  }),
  food("flaxseed", "ground flaxseed", ["flaxseed", "flax seeds", "linseed", "fara liri"], "nut_seed", "fat", M, [534, 18.3, 28.9, 42.2, 27.3], {
    units: { tbsp: 10 }, display: "tbsp", serving: 10, maxPerMeal: 30, prep: 0, cost: 1, swaps: ["chia_seeds"],
  }),
  food("pumpkin_seeds", "pumpkin seeds", ["pepitas", "fara kungulli"], "nut_seed", "fat", W, [559, 30, 10.7, 49, 6], {
    units: { handful: 28, tbsp: 9 }, serving: 25, maxPerMeal: 50, prep: 0, cost: 2, swaps: ["sunflower_seeds", "almonds"],
  }),
  food("sunflower_seeds", "sunflower seeds", ["fara luledielli"], "nut_seed", "fat", W, [584, 20.8, 20, 51.5, 8.6], {
    units: { handful: 28, tbsp: 9 }, serving: 25, maxPerMeal: 50, prep: 0, cost: 1, swaps: ["pumpkin_seeds"],
  }),
  food("hummus", "hummus", ["houmous", "humus"], "legume", "fat", P, [166, 7.9, 14.3, 9.6, 6], {
    units: { tbsp: 15 }, serving: 60, maxPerMeal: 120, prep: 0, cost: 2, swaps: ["avocado", "tahini"],
  }),
  food("dark_chocolate", "dark chocolate (70%+)", ["dark chocolate", "cokollate e zeze"], "sweet", "treat", P, [598, 7.8, 46, 43, 10.9], {
    units: { piece: 10 }, serving: 20, maxPerMeal: 30, prep: 0, cost: 2, swaps: ["berries", "dates"],
  }),

  // ─── Dairy alternatives ─────────────────────────────────────────────────
  food("soy_milk", "unsweetened soy milk", ["soy milk", "soya milk", "unsweetened soya milk"], "dairy_alt", "mixed", P, [33, 2.9, 1.7, 1.6, 0.4], {
    units: { cup: 250 }, display: "ml", density: 1.03, serving: 250, maxPerMeal: 500, tags: ["soy"], prep: 0, cost: 2, swaps: ["oat_milk", "milk"],
  }),
  food("coconut_milk", "light coconut milk", ["coconut milk", "canned coconut milk"], "dairy_alt", "fat", P, [74, 0.7, 1.7, 7.2, 0], {
    units: { cup: 240, tbsp: 15 }, display: "ml", density: 1.0, serving: 100, maxPerMeal: 200, prep: 0, cost: 2, common: true, swaps: ["olive_oil"],
  }),
  food("oat_milk", "oat milk", ["oat drink", "rice milk"], "dairy_alt", "mixed", P, [46, 1, 6.7, 1.5, 0.8], {
    units: { cup: 250 }, display: "ml", density: 1.03, serving: 250, maxPerMeal: 500, prep: 0, cost: 2, swaps: ["soy_milk", "milk"],
  }),
  food("almond_milk", "unsweetened almond milk", ["almond milk", "almond drink"], "dairy_alt", "mixed", P, [15, 0.6, 0.3, 1.2, 0.2], {
    units: { cup: 250 }, display: "ml", density: 1.02, serving: 250, maxPerMeal: 500, tags: ["nuts"], prep: 0, cost: 2, swaps: ["oat_milk", "soy_milk"],
  }),
  food("soy_yogurt", "plain soy yogurt", ["soy yogurt", "soya yogurt", "plant yogurt", "plant-based yogurt", "dairy-free yogurt"], "dairy_alt", "protein", P, [66, 4.5, 4, 3.5, 0.5], {
    units: { cup: 245 }, serving: 170, maxPerMeal: 300, tags: ["soy"], prep: 0, cost: 2, swaps: ["coconut_yogurt", "greek_yogurt"],
  }),
  food("coconut_yogurt", "coconut yogurt", ["coconut yoghurt"], "dairy_alt", "fat", P, [110, 1, 5, 9.5, 1], {
    units: { cup: 245 }, serving: 125, maxPerMeal: 250, prep: 0, cost: 3, common: false, swaps: ["soy_yogurt"],
  }),

  // ─── Condiments & seasonings ────────────────────────────────────────────
  food("seasoning", "salt & pepper", ["salt", "salt and pepper", "pepper to taste", "black pepper", "spices", "herbs", "seasoning", "paprika", "cumin", "oregano", "basil", "parsley", "cinnamon", "garlic powder", "chili flakes", "kripe", "erëza", "ereza", "piper i zi"], "seasoning", "condiment", W, [0, 0, 0, 0, 0], {
    serving: 1, maxPerMeal: 10, prep: 0, cost: 1,
  }),
  food("garlic", "garlic", ["garlic clove", "garlic cloves", "hudhër", "hudher"], "seasoning", "condiment", W, [149, 6.4, 33, 0.5, 2.1], {
    units: { piece: 3 }, serving: 3, maxPerMeal: 15, prep: 0, cost: 1,
  }),
  food("lemon", "lemon juice", ["lemon", "lime", "lemon wedge", "squeeze of lemon", "limon"], "seasoning", "condiment", W, [22, 0.4, 6.9, 0.2, 0.3], {
    units: { tbsp: 15, piece: 30 }, serving: 10, maxPerMeal: 30, prep: 0, cost: 1,
  }),
  food("vinegar", "vinegar", ["balsamic vinegar", "apple cider vinegar", "uthull"], "condiment", "condiment", P, [88, 0.5, 17, 0, 0], {
    units: { tbsp: 15 }, display: "tbsp", serving: 10, maxPerMeal: 30, prep: 0, cost: 1,
  }),
  food("soy_sauce", "soy sauce", ["salce soje"], "condiment", "condiment", P, [53, 8, 4.9, 0.6, 0.8], {
    units: { tbsp: 16 }, display: "tbsp", serving: 10, maxPerMeal: 30, tags: ["soy", "gluten"], prep: 0, cost: 1,
  }),
  food("mustard", "mustard", ["mustarde"], "condiment", "condiment", P, [66, 4, 5.8, 3.3, 3.3], {
    units: { tbsp: 15 }, display: "tbsp", serving: 10, maxPerMeal: 30, prep: 0, cost: 1,
  }),
  food("salsa", "salsa", ["tomato salsa", "pico de gallo"], "condiment", "condiment", P, [36, 1.5, 7, 0.2, 1.9], {
    units: { tbsp: 16 }, serving: 60, maxPerMeal: 120, prep: 0, cost: 1,
  }),
  food("honey", "honey", ["raw honey", "mjalte"], "sweetener", "condiment", M, [304, 0.3, 82, 0, 0.2], {
    units: { tbsp: 21 }, display: "tbsp", serving: 10, maxPerMeal: 25, tags: ["animal_products"], prep: 0, cost: 2,
  }),
  food("maple_syrup", "maple syrup", [], "sweetener", "condiment", M, [260, 0, 67, 0.1, 0], {
    units: { tbsp: 20 }, display: "tbsp", serving: 10, maxPerMeal: 25, prep: 0, cost: 3,
  }),
  food("ketchup", "ketchup", ["tomato ketchup"], "condiment", "condiment", P, [101, 1.2, 27, 0.1, 0.3], {
    units: { tbsp: 17 }, display: "tbsp", serving: 15, maxPerMeal: 30, prep: 0, cost: 1,
  }),
  food("mayonnaise", "mayonnaise", ["mayo", "majonez"], "condiment", "condiment", P, [680, 1, 0.6, 75, 0], {
    units: { tbsp: 14 }, display: "tbsp", serving: 14, maxPerMeal: 30, tags: ["eggs"], prep: 0, cost: 1,
  }),
  food("water", "water", ["sparkling water", "ujë", "uje"], "beverage", "beverage", W, [0, 0, 0, 0, 0], {
    units: { cup: 250 }, display: "ml", serving: 500, maxPerMeal: 1000, prep: 0, cost: 1,
  }),
  food("coffee", "black coffee", ["coffee", "espresso", "kafe"], "beverage", "beverage", M, [2, 0.3, 0, 0, 0], {
    units: { cup: 240 }, display: "ml", serving: 240, maxPerMeal: 500, prep: 0, cost: 1,
  }),
  food("tea", "tea", ["green tea", "herbal tea", "caj"], "beverage", "beverage", M, [1, 0, 0.3, 0, 0], {
    units: { cup: 240 }, display: "ml", serving: 240, maxPerMeal: 500, prep: 0, cost: 1,
  }),

  // ─── Processed meats (allowed occasionally, never the default) ─────────
  food("ham", "ham", ["deli ham", "sliced ham", "proshute"], "pork", "protein", P, [145, 21, 1.5, 6, 0], {
    units: { slice: 15 }, serving: 60, maxPerMeal: 120, tags: ["pork"], prep: 0, cost: 2, swaps: ["turkey_breast", "chicken_breast", "eggs"],
  }),
  food("turkey_slices", "turkey slices", ["deli turkey", "sliced turkey", "turkey ham"], "poultry", "protein", P, [110, 20, 3, 2, 0], {
    units: { slice: 15 }, serving: 60, maxPerMeal: 120, tags: ["poultry"], prep: 0, cost: 2, swaps: ["turkey_breast", "chicken_breast", "eggs"],
  }),
  food("bacon", "bacon", ["bacon rashers"], "pork", "protein", P, [541, 37, 1.4, 42, 0], {
    units: { slice: 8 }, serving: 24, maxPerMeal: 50, tags: ["pork"], prep: 1, cost: 2, swaps: ["eggs", "turkey_breast"],
  }),
  food("sausage", "sausages", ["sausage", "suxhuk", "salsiçe", "salsice", "hot dog", "frankfurter"], "pork", "protein", H, [301, 12, 2, 27, 0], {
    units: { piece: 50 }, display: "piece", serving: 100, maxPerMeal: 150, tags: ["pork"], prep: 1, cost: 1, swaps: ["beef_mince", "turkey_mince", "eggs"],
  }),
  food("salami", "salami", ["pepperoni", "chorizo", "sallam"], "pork", "protein", H, [407, 22, 1.6, 34, 0], {
    serving: 30, maxPerMeal: 60, tags: ["pork"], prep: 0, cost: 2, swaps: ["turkey_breast", "eggs"],
  }),

  // ─── Highly processed (flagged, swapped by default) ──────────────────────
  food("protein_powder", "whey protein powder", ["whey", "whey protein", "protein powder", "protein shake", "whey isolate", "casein", "casein protein", "proteine", "shake proteinik"], "supplement", "protein", H, [400, 80, 8, 6, 0], {
    units: { scoop: 30 }, serving: 30, maxPerMeal: 60, tags: ["dairy"], prep: 0, cost: 3, swaps: ["greek_yogurt", "eggs", "cottage_cheese", "tofu"],
  }),
  food("plant_protein_powder", "pea protein powder", ["pea protein", "plant protein powder", "vegan protein powder", "rice protein powder", "pea protein powder"], "supplement", "protein", H, [380, 80, 3, 7, 1], {
    units: { scoop: 30 }, serving: 30, maxPerMeal: 60, prep: 0, cost: 3, swaps: ["tofu", "lentils", "soy_yogurt"],
  }),
  food("protein_bar", "protein bar", ["protein bars", "energy bar", "granola bar", "cereal bar", "snack bar"], "snack", "treat", H, [350, 30, 40, 10, 5], {
    units: { piece: 60 }, display: "piece", serving: 60, maxPerMeal: 120, tags: ["dairy"], prep: 0, cost: 3, swaps: ["greek_yogurt", "eggs", "banana"],
  }),
  food("sugary_cereal", "sugary cereal", ["breakfast cereal", "cereal", "frosted flakes", "corn flakes", "cornflakes", "cereals", "drithera"], "grain", "carb", H, [380, 6, 86, 2.5, 3], {
    units: { cup: 30 }, serving: 40, maxPerMeal: 80, tags: ["gluten"], prep: 0, cost: 2, swaps: ["oats", "muesli"],
  }),
  food("granola", "granola", ["crunchy granola"], "grain", "carb", H, [470, 10, 64, 20, 7], {
    units: { cup: 120 }, serving: 45, maxPerMeal: 80, tags: ["gluten"], prep: 0, cost: 2, swaps: ["oats", "muesli"],
  }),
  food("chips", "potato chips", ["chips", "crisps", "tortilla chips", "patatina", "çips", "cips"], "snack", "treat", H, [536, 7, 53, 35, 4.4], {
    serving: 30, maxPerMeal: 60, prep: 0, cost: 1, swaps: ["nuts_mixed", "popcorn", "carrot"],
  }),
  food("popcorn", "plain popcorn", ["popcorn", "air popped popcorn", "kokoshka"], "grain", "carb", M, [387, 13, 78, 4.5, 14.5], {
    units: { cup: 8 }, serving: 25, maxPerMeal: 50, prep: 1, cost: 1, swaps: ["rice_cakes"],
  }),
  food("cookies", "cookies", ["cookie", "biscuits", "biscuit", "biskota", "biskote"], "sweet", "treat", H, [480, 5, 66, 22, 2], {
    units: { piece: 15 }, display: "piece", serving: 30, maxPerMeal: 60, tags: ["gluten"], prep: 0, cost: 1, swaps: ["banana", "apple", "dates"],
  }),
  food("cake", "cake", ["pastry", "pastries", "croissant", "donut", "doughnut", "muffin", "muffins", "brownie", "torte", "embelsire", "kek", "kroasan"], "sweet", "treat", H, [400, 5, 52, 19, 1.5], {
    serving: 80, maxPerMeal: 120, tags: ["gluten", "eggs", "dairy"], prep: 0, cost: 2, swaps: ["banana", "berries", "greek_yogurt"],
  }),
  food("candy", "candy", ["sweets", "gummies", "gummy bears", "chocolate bar", "milk chocolate", "karamele", "cokollate"], "sweet", "treat", H, [450, 3, 80, 15, 1], {
    serving: 30, maxPerMeal: 60, prep: 0, cost: 1, swaps: ["dates", "berries", "banana"],
  }),
  food("ice_cream", "ice cream", ["akullore", "gelato"], "sweet", "treat", H, [207, 3.5, 24, 11, 0.7], {
    serving: 100, maxPerMeal: 150, tags: ["dairy"], prep: 0, cost: 2, swaps: ["greek_yogurt", "berries", "banana"],
  }),
  food("soda", "soft drink", ["soda", "cola", "coke", "soft drinks", "fizzy drink", "lemonade", "energy drink", "iced tea", "sweetened iced tea", "pije e gazuar"], "beverage", "beverage", H, [41, 0, 10.6, 0, 0], {
    units: { can: 330 }, display: "ml", density: 1.04, serving: 330, maxPerMeal: 500, prep: 0, cost: 1, swaps: ["water"],
  }),
  food("fast_food", "fast food burger", ["burger", "cheeseburger", "hamburger", "fries", "french fries", "chicken nuggets", "nuggets", "pizza", "fried chicken", "hot pocket", "kebab", "gyro", "sufllaqe"], "fast_food", "mixed", H, [270, 12, 28, 13, 1.8], {
    serving: 200, maxPerMeal: 350, tags: ["gluten", "dairy"], prep: 0, cost: 2, swaps: ["lean_beef", "potatoes", "chicken_breast"],
  }),
  food("instant_noodles", "instant noodles", ["ramen noodles", "cup noodles", "pot noodle"], "fast_food", "carb", H, [450, 9, 60, 19, 2.5], {
    serving: 80, maxPerMeal: 120, tags: ["gluten"], prep: 1, cost: 1, swaps: ["rice_noodles", "white_rice"],
  }),
  food("ready_meal", "ready meal", ["microwave meal", "frozen meal", "tv dinner", "frozen pizza"], "fast_food", "mixed", H, [150, 7, 17, 6, 1.5], {
    serving: 350, maxPerMeal: 450, prep: 0, cost: 2, swaps: ["chicken_breast", "white_rice", "mixed_vegetables"],
  }),
  food("margarine", "margarine", ["vegetable spread", "margarinë", "margarine spread"], "fat_oil", "fat", H, [717, 0.2, 0.7, 80, 0], {
    units: { tbsp: 14 }, display: "tbsp", serving: 10, maxPerMeal: 20, prep: 0, cost: 1, swaps: ["olive_oil"],
  }),
  food("flavored_yogurt", "sweetened fruit yogurt", ["fruit yogurt", "flavoured yogurt", "flavored yogurt", "strawberry yogurt", "vanilla yogurt", "protein pudding", "protein yogurt"], "dairy", "treat", H, [100, 3.5, 16, 2.5, 0], {
    units: { cup: 245 }, serving: 150, maxPerMeal: 250, tags: ["dairy"], prep: 0, cost: 2, swaps: ["greek_yogurt", "yogurt"],
  }),
];

export const FOOD_BY_ID = new Map(FOOD_CATALOG.map((f) => [f.id, f]));

export function getFood(id: string): FoodItem | undefined {
  return FOOD_BY_ID.get(id);
}

export type FoodLang = "al" | "en";

/** Client-facing food name in the plan language. */
export function foodDisplayName(food: FoodItem, lang: FoodLang = "en"): string {
  return lang === "al" && food.nameSq ? food.nameSq : food.name;
}

// ─── Matching ───────────────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeFoodText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9%'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type AliasEntry = { food: FoodItem; alias: string; re: RegExp };

const ALIAS_INDEX: AliasEntry[] = FOOD_CATALOG.flatMap((f) =>
  f.aliases.map((alias) => {
    const a = normalizeFoodText(alias);
    const body = a.split(" ").map(escapeRe).join("[\\s-]+");
    return { food: f, alias: a, re: new RegExp(`(?:^|[^a-z])${body}(?:e?s)?(?=$|[^a-z])`) };
  })
).sort((a, b) => b.alias.length - a.alias.length);

export type FoodMatch = { food: FoodItem; alias: string; index: number };

/** All distinct catalog foods mentioned in a text, longest alias first, no overlaps. */
export function matchFoods(text: string): FoodMatch[] {
  const t = normalizeFoodText(text.replace(/\([^)]*\)/g, " "));
  if (!t) return [];
  const taken: [number, number][] = [];
  const out: FoodMatch[] = [];
  for (const entry of ALIAS_INDEX) {
    const m = entry.re.exec(t);
    if (!m) continue;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    const end = m.index + m[0].length;
    if (taken.some(([s, e]) => start < e && end > s)) continue;
    if (out.some((o) => o.food.id === entry.food.id)) continue;
    taken.push([start, end]);
    out.push({ food: entry.food, alias: entry.alias, index: start });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Best single catalog match for an ingredient name (longest alias wins). */
export function matchFood(text: string): FoodItem | null {
  const matches = matchFoods(text);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => b.alias.length - a.alias.length)[0]!.food;
}

export function isWholeFoodLevel(p: ProcessingLevel): boolean {
  return p === "whole" || p === "minimally_processed";
}

/** Words that mark a highly processed item even when it is not in the catalog. */
export const HIGHLY_PROCESSED_TEXT_RE =
  /\b(?:candy|candies|sweets|chips|crisps|cookies?|biscuits?|cakes?|pastr(?:y|ies)|croissants?|donuts?|doughnuts?|muffins?|brownies?|sugary cereal|frosted|soda|cola|soft drinks?|energy drinks?|fast food|burgers?|fries|nuggets|pizza|instant noodles|ready meals?|microwave meals?|protein bars?|granola bars?|cereal bars?|ice cream|milkshakes?|hot dogs?|pop tarts?|gummies|gummy|marshmallows?|syrup-soaked|frosting)\b/i;
