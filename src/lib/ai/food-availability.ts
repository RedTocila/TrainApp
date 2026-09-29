/**
 * Regional food availability and relative cost, so plans use what the client
 * can actually buy in a normal local supermarket. Pure.
 */

import { normalizeFoodText, type FoodItem } from "@/lib/ai/food-catalog";

export type FoodRegion = "balkans" | "north_america" | "western_europe" | "global";
export type Availability = "common" | "limited" | "rare";

type RegionEntry = { availability?: Availability; cost?: 1 | 2 | 3 };

const BALKANS: Record<string, RegionEntry> = {
  tempeh: { availability: "rare" },
  edamame: { availability: "rare" },
  coconut_yogurt: { availability: "rare" },
  soy_yogurt: { availability: "rare" },
  sunflower_seed_butter: { availability: "rare" },
  corn_tortilla: { availability: "rare" },
  maple_syrup: { availability: "rare" },
  plant_protein_powder: { availability: "rare" },
  black_beans: { availability: "limited" },
  kale: { availability: "limited" },
  sweet_potato: { availability: "limited", cost: 3 },
  quinoa: { availability: "limited", cost: 3 },
  almond_milk: { availability: "limited", cost: 3 },
  oat_milk: { availability: "limited", cost: 3 },
  soy_milk: { availability: "limited" },
  tofu: { availability: "limited", cost: 3 },
  rice_cakes: { availability: "limited" },
  wholewheat_wrap: { availability: "limited" },
  asparagus: { availability: "limited", cost: 3 },
  mango: { availability: "limited", cost: 3 },
  avocado: { availability: "limited", cost: 3 },
  berries: { availability: "limited", cost: 3 },
  tahini: { availability: "limited" },
  hummus: { availability: "limited" },
  couscous: { availability: "limited" },
  shrimp: { cost: 3 },
  salmon: { cost: 3 },
  buckwheat: { availability: "limited" },
  // Everyday staples in Albania / Kosovo / the region.
  cottage_cheese: { availability: "common", cost: 1 },
  feta: { availability: "common", cost: 1 },
  yogurt: { availability: "common", cost: 1 },
  trout: { availability: "common", cost: 2 },
  sardines: { availability: "common", cost: 1 },
  kidney_beans: { availability: "common", cost: 1 },
  lamb: { availability: "common", cost: 2 },
  bulgur: { availability: "common", cost: 1 },
  bell_pepper: { availability: "common", cost: 1 },
};

const NORTH_AMERICA: Record<string, RegionEntry> = {
  tempeh: { availability: "limited" },
  kale: { availability: "common" },
  buckwheat: { availability: "limited" },
  coconut_yogurt: { availability: "limited" },
  sunflower_seed_butter: { availability: "limited" },
  trout: { availability: "limited", cost: 3 },
  lamb: { availability: "limited", cost: 3 },
  sardines: { availability: "limited" },
  corn_tortilla: { availability: "common", cost: 1 },
  black_beans: { availability: "common", cost: 1 },
};

const WESTERN_EUROPE: Record<string, RegionEntry> = {
  tempeh: { availability: "limited" },
  edamame: { availability: "limited" },
  corn_tortilla: { availability: "limited" },
  maple_syrup: { availability: "limited" },
  black_beans: { availability: "limited" },
  sunflower_seed_butter: { availability: "rare" },
  kale: { availability: "common" },
};

const REGIONS: Record<FoodRegion, Record<string, RegionEntry>> = {
  balkans: BALKANS,
  north_america: NORTH_AMERICA,
  western_europe: WESTERN_EUROPE,
  global: {},
};

export function foodAvailability(food: FoodItem, region: FoodRegion): Availability {
  return REGIONS[region][food.id]?.availability ?? (food.common ? "common" : "limited");
}

export function regionalCost(food: FoodItem, region: FoodRegion): 1 | 2 | 3 {
  return REGIONS[region][food.id]?.cost ?? food.cost;
}

const REGION_PATTERNS: [FoodRegion, RegExp][] = [
  [
    "balkans",
    /\b(?:albania|shqiperi\w*|tirane?|tirana|durres|vlore|shkoder|elbasan|korce|fier|kosov[oa]\w*|prishtin\w*|prizren|macedonia|maqedoni\w*|skopje|shkup|tetov\w*|montenegro|mal i zi|podgorica|ulqin\w*|serbia|belgrade|bosnia|sarajevo|croatia|zagreb|greece|greqi\w*|athens|athine)\b/,
  ],
  [
    "north_america",
    /\b(?:usa|united states|america|amerik\w*|canada|kanada|new york|nju jork|los angeles|chicago|boston|texas|california|florida|toronto|montreal|vancouver)\b/,
  ],
  [
    "western_europe",
    /\b(?:uk|united kingdom|england|angli\w*|britain|london|londer\w*|ireland|germany|gjermani\w*|berlin|munich|france|franc\w*|paris|italy|itali\w*|rome|milan|spain|spanj\w*|madrid|netherlands|holand\w*|amsterdam|belgium|belgjik\w*|switzerland|zvicer\w*|zurich|austria|austri\w*|vienna|sweden|suedi\w*|norway|norvegji\w*|denmark|danimark\w*)\b/,
  ],
];

const LIVE_CUE_RE = /\b(?:i live|i'm in|i am in|living in|based in|i'm from|i am from|from|jetoj|banoj|jam ne|jam nga|nga)\b/;

/**
 * Where the client shops: latest message that names a place wins; otherwise
 * Albanian app language → Balkans; otherwise a neutral "global" profile.
 */
export function resolveFoodRegion(texts: readonly string[], locale?: string | null): FoodRegion {
  for (const raw of [...texts].reverse()) {
    const t = normalizeFoodText(raw);
    const hits = REGION_PATTERNS.filter(([, re]) => re.test(t));
    if (hits.length === 1) return hits[0]![0];
    if (hits.length > 1 && LIVE_CUE_RE.test(t)) {
      const cue = t.search(LIVE_CUE_RE);
      const after = t.slice(cue);
      const found = hits.find(([, re]) => re.test(after));
      if (found) return found[0];
    }
  }
  return locale === "al" ? "balkans" : "global";
}

export const REGION_LABEL: Record<FoodRegion, string> = {
  balkans: "Albania / Balkans",
  north_america: "North America",
  western_europe: "Western Europe",
  global: "general supermarket",
};

const PROCESSED_MEAT_IDS = new Set(["ham", "turkey_slices", "bacon", "sausage", "salami"]);
const NOT_ON_MENU_ROLES = new Set(["beverage", "condiment", "treat"]);

export type PracticalityOptions = {
  region: FoodRegion;
  /** Limited-availability foods are fine when the client wants variety or recipes. */
  allowLimited: boolean;
  budget: boolean;
  /** Foods the client asked for by name — always allowed. */
  requested?: ReadonlySet<string>;
};

/** Everyday, whole-food-first, locally available foods for building menus. */
export function isPracticalMenuFood(food: FoodItem, opts: PracticalityOptions): boolean {
  if (opts.requested?.has(food.id)) return true;
  if (food.processing === "highly_processed") return false;
  if (PROCESSED_MEAT_IDS.has(food.id)) return false;
  if (NOT_ON_MENU_ROLES.has(food.role)) return false;
  if (food.group === "seasoning") return false;
  const availability = foodAvailability(food, opts.region);
  if (availability === "rare") return false;
  if (availability === "limited" && !opts.allowLimited) return false;
  if (opts.budget && regionalCost(food, opts.region) === 3) return false;
  return true;
}
