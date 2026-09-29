/**
 * Portion parsing ("150g", "1 cup (185g)", "3 large", "2 slices", "1 tbsp") →
 * grams, and grams → a clean display amount. Pure.
 */

import type { FoodItem, FoodLang } from "@/lib/ai/food-catalog";

export type PortionUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "oz"
  | "lb"
  | "cup"
  | "tbsp"
  | "tsp"
  | "slice"
  | "piece"
  | "scoop"
  | "handful"
  | "can"
  | "serving"
  | "pinch"
  | "drizzle"
  | "clove";

export type ParsedAmount = {
  qty: number;
  unit: PortionUnit | null;
  size?: "small" | "medium" | "large";
};

const UNIT_PATTERNS: [RegExp, PortionUnit][] = [
  [/^(?:kg|kilo(?:gram)?s?)\b/, "kg"],
  [/^(?:g|gr|grams?|gms?|grame)\b/, "g"],
  [/^(?:ml|millilit(?:er|re)s?)\b/, "ml"],
  [/^(?:l|lit(?:er|re)s?|litra?)\b/, "l"],
  [/^(?:oz|ounces?)\b/, "oz"],
  [/^(?:lbs?|pounds?)\b/, "lb"],
  [/^(?:cups?|filxhan(?:e)?|gote)\b/, "cup"],
  [/^(?:tbsps?|tbs|tablespoons?|luge(?! caji)(?: gjelle)?)\b/, "tbsp"],
  [/^(?:tsps?|teaspoons?|luge caji)\b/, "tsp"],
  [/^(?:slices?|fete|feta)\b/, "slice"],
  [/^(?:pieces?|pcs?|whole|units?|fillets?|breasts?|thighs?|cope)\b/, "piece"],
  [/^(?:scoops?)\b/, "scoop"],
  [/^(?:handfuls?|grusht)\b/, "handful"],
  [/^(?:cans?|tins?|kanace)\b/, "can"],
  [/^(?:servings?|portions?|racion(?:e)?)\b/, "serving"],
  [/^(?:pinch(?:es)?|dash(?:es)?|to taste|sipas shijes)\b/, "pinch"],
  [/^(?:drizzles?|splash(?:es)?)\b/, "drizzle"],
  [/^(?:cloves?)\b/, "clove"],
];

const WORD_QTY: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  half: 0.5,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  nje: 1,
  dy: 2,
  tre: 3,
  kater: 4,
  gjysme: 0.5,
};

const UNICODE_FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQty(s: string): { qty: number; rest: string } | null {
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (m) return { qty: +m[1]! + +m[2]! / +m[3]!, rest: s.slice(m[0].length) };
  m = s.match(/^(\d+)?\s*([½¼¾⅓⅔])/);
  if (m) return { qty: (m[1] ? +m[1] : 0) + UNICODE_FRACTIONS[m[2]!]!, rest: s.slice(m[0].length) };
  m = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (m && +m[2]! > 0) return { qty: +m[1]! / +m[2]!, rest: s.slice(m[0].length) };
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/);
  if (m) return { qty: (+m[1]! + +m[2]!) / 2, rest: s.slice(m[0].length) };
  m = s.match(/^(\d+(?:\.\d+)?)/);
  if (m) return { qty: +m[1]!, rest: s.slice(m[0].length) };
  m = s.match(/^([a-z]+)\b/);
  if (m && WORD_QTY[m[1]!] != null) return { qty: WORD_QTY[m[1]!]!, rest: s.slice(m[0].length) };
  return null;
}

/** Parse an amount string. Returns null when nothing usable is present. */
export function parseAmount(text: string | null | undefined): ParsedAmount | null {
  if (!text?.trim()) return null;
  const s = norm(text).replace(/^(?:about|approx\.?|approximately|around|~|ca\.?|rreth)\s*/, "");

  const explicit = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|grams?|ml|l)\b/);
  if (explicit) {
    const unit = UNIT_PATTERNS.find(([re]) => re.test(explicit[2]!))?.[1] ?? "g";
    return { qty: +explicit[1]!, unit };
  }
  if (/\b(?:to taste|sipas shijes)\b/.test(s)) return { qty: 1, unit: "pinch" };

  const q = parseQty(s);
  let rest = (q?.rest ?? s).replace(/^\s*(?:x|×)\s*/, "").trim();
  let size: ParsedAmount["size"];
  const sizeM = rest.match(/^(small|medium|large|big|extra large|mesatare?|(?:e|i|te) (?:madhe|madh|medha|medhenj)|(?:e|i|te) (?:vogel|vogla|vegjel))\b\s*/);
  if (sizeM) {
    const word = sizeM[1]!;
    size = /small|vog|vegj/.test(word) ? "small" : /medium|mesatar/.test(word) ? "medium" : "large";
    rest = rest.slice(sizeM[0].length);
  }
  rest = rest.replace(/^(?:of\s+)/, "");
  const unit = UNIT_PATTERNS.find(([re]) => re.test(rest))?.[1] ?? null;
  if (!q && !unit && !size) return null;
  return { qty: q?.qty ?? 1, unit, size };
}

/** "3 eggs", "150g chicken", "2 slices bread" → amount found at the start of a name. */
export function parseAmountFromName(name: string): ParsedAmount | null {
  const s = norm(name);
  if (!/^(?:\d|[½¼¾⅓⅔]|(?:a|an|one|two|three|four|five|six|half)\s)/.test(s)) return null;
  return parseAmount(s);
}

export function stateFromText(text: string): "raw" | "cooked" | null {
  const s = norm(text);
  if (/\b(?:raw|uncooked|dry|dried weight|dry weight|te paziera|i pazier|pa gatuar)\b/.test(s)) return "raw";
  if (/\b(?:cooked|boiled|grilled|baked|roasted|steamed|poached|fried|seared|sauteed|pan|te ziera|i zier|i pjekur)\b/.test(s)) return "cooked";
  return null;
}

const SIZE_FACTOR = { small: 0.75, medium: 1, large: 1.25 } as const;

function defaultCup(food: FoodItem): number {
  switch (food.group) {
    case "vegetable":
      return food.id === "salad" || food.id === "spinach" ? 40 : 100;
    case "fruit":
      return 150;
    case "grain":
      return food.basis === "dry" ? 80 : 170;
    case "legume":
      return 170;
    case "nut_seed":
      return 140;
    case "dairy":
    case "dairy_alt":
    case "beverage":
      return 245;
    default:
      return 150;
  }
}

function defaultTbsp(food: FoodItem): number {
  if (food.group === "fat_oil") return 13.5;
  if (food.group === "nut_seed") return 12;
  if (food.group === "sweetener") return 20;
  return 15;
}

export type PortionGrams = { grams: number; estimated: boolean };

/** Convert a parsed amount into grams for a catalog food. */
export function gramsForAmount(food: FoodItem, parsed: ParsedAmount | null): PortionGrams {
  if (!parsed) return { grams: food.serving, estimated: true };
  const { qty } = parsed;
  const u = food.units;
  const density = food.density ?? 1;
  switch (parsed.unit) {
    case "g":
      return { grams: qty, estimated: false };
    case "kg":
      return { grams: qty * 1000, estimated: false };
    case "ml":
      return { grams: qty * density, estimated: false };
    case "l":
      return { grams: qty * 1000 * density, estimated: false };
    case "oz":
      return { grams: qty * 28.35, estimated: false };
    case "lb":
      return { grams: qty * 453.6, estimated: false };
    case "cup":
      return { grams: qty * (u.cup ?? defaultCup(food)), estimated: u.cup == null };
    case "tbsp":
      return { grams: qty * (u.tbsp ?? defaultTbsp(food)), estimated: u.tbsp == null };
    case "tsp":
      return { grams: (qty * (u.tbsp ?? defaultTbsp(food))) / 3, estimated: u.tbsp == null };
    case "slice":
      return { grams: qty * (u.slice ?? 30), estimated: u.slice == null };
    case "scoop":
      return { grams: qty * (u.scoop ?? 30), estimated: u.scoop == null };
    case "handful":
      return { grams: qty * (u.handful ?? (food.group === "vegetable" ? 40 : 30)), estimated: true };
    case "can":
      return { grams: qty * (u.can ?? 240), estimated: u.can == null };
    case "serving":
      return { grams: qty * food.serving, estimated: true };
    case "pinch":
      return { grams: 1, estimated: false };
    case "drizzle":
      return { grams: qty * 5, estimated: true };
    case "clove":
      return { grams: qty * 3, estimated: false };
    case "piece":
    case null: {
      if (parsed.unit === null && qty > 15 && !parsed.size) {
        return { grams: qty, estimated: true };
      }
      // units.piece is already the weight of a `pieceLabel`-sized piece (e.g. a large egg).
      const base = food.pieceLabel === "small" || food.pieceLabel === "large" ? food.pieceLabel : "medium";
      const size = SIZE_FACTOR[parsed.size ?? base] / SIZE_FACTOR[base];
      if (u.piece) return { grams: qty * u.piece * size, estimated: false };
      return { grams: qty * food.serving * size, estimated: true };
    }
  }
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function fmtNumber(v: number): string {
  if (Math.abs(v - 0.5) < 1e-9) return "½";
  if (Number.isInteger(v)) return String(v);
  const whole = Math.floor(v);
  if (Math.abs(v - whole - 0.5) < 1e-9) return `${whole}½`;
  return v.toFixed(1);
}

export function roundGrams(grams: number): number {
  if (grams < 15) return Math.max(1, Math.round(grams));
  if (grams < 100) return roundTo(grams, 5);
  return roundTo(grams, 10);
}

/**
 * Clean display amount for a food and the grams that amount really represents
 * (nutrition is always computed from the returned grams).
 */
export function formatPortion(food: FoodItem, grams: number, lang: FoodLang = "en"): { amount: string; grams: number } {
  const g = Math.max(0, grams);
  const al = lang === "al";
  if (food.group === "seasoning" && food.per100.calories === 0) return { amount: al ? "sipas shijes" : "to taste", grams: 1 };
  const u = food.units;
  if (food.display === "piece" && u.piece) {
    const step = u.piece >= 100 ? 0.5 : 1;
    const count = Math.max(step, roundTo(g / u.piece, step));
    return {
      amount: `${fmtNumber(count)}${food.pieceLabel && !al ? ` ${food.pieceLabel}` : ""}`,
      grams: count * u.piece,
    };
  }
  if (food.display === "slice" && u.slice) {
    const count = Math.max(1, Math.round(g / u.slice));
    const unit = al ? (count === 1 ? "fetë" : "feta") : `slice${count === 1 ? "" : "s"}`;
    return { amount: `${count} ${unit}`, grams: count * u.slice };
  }
  if (food.display === "tbsp" && u.tbsp) {
    const count = Math.max(0.5, roundTo(g / u.tbsp, 0.5));
    return { amount: `${fmtNumber(count)} ${al ? "lugë" : "tbsp"}`, grams: count * u.tbsp };
  }
  if (food.display === "ml") {
    const density = food.density ?? 1;
    const ml = Math.max(50, roundTo(g / density, g / density < 200 ? 10 : 25));
    return { amount: `${ml}ml`, grams: ml * density };
  }
  const rounded = roundGrams(g);
  return { amount: `${rounded}g`, grams: rounded };
}
