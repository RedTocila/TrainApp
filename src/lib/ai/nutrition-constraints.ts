/**
 * Hard food constraints for nutrition plans: taxonomy, extraction (profile +
 * chat), validation of meals / ingredients / grocery list, deterministic fixes.
 * Pure — no LLM, no I/O.
 */

import { normalizeUserText, parseConstraintText, splitTargetList } from "@/lib/ai/constraint-language";
import type { AiGeneratedNutritionPlan, AiNutritionMeal } from "@/lib/ai/plan-builder-types";

export type FoodCategoryId =
  | "dairy"
  | "chicken"
  | "poultry"
  | "fish"
  | "shellfish"
  | "seafood"
  | "eggs"
  | "gluten"
  | "soy"
  | "nuts"
  | "peanuts"
  | "red_meat"
  | "pork"
  | "meat"
  | "animal_products";

type FoodCategory = {
  id: FoodCategoryId;
  label: string;
  /** Word stems (matched with word boundaries, optional plural). */
  terms: string[];
  /** Phrases that contain a term but are safe (removed before matching). */
  safe?: string[];
  /** Categories implied by this one (e.g. meat ⊃ poultry). */
  includes?: FoodCategoryId[];
};

const PLANT_PROTEIN = "(?:pea|rice|soy|hemp|plant|plant[- ]based|vegan|pumpkin seed|egg white|beef isolate)";

const CATEGORIES: FoodCategory[] = [
  {
    id: "dairy",
    label: "dairy",
    terms: [
      "dairy", "milk", "cheese", "cheddar", "mozzarella", "parmesan", "feta", "ricotta", "halloumi",
      "mascarpone", "brie", "gouda", "paneer", "cottage cheese", "cream cheese", "yogurt", "yoghurt",
      "skyr", "quark", "kefir", "butter", "buttermilk", "ghee", "cream", "sour cream", "whipped cream",
      "ice cream", "custard", "whey", "casein", "lactose", "labneh", "curd", "tzatziki", "milkshake",
      "latte", "cappuccino", "queso", "burrata",
    ],
    safe: [
      "(?:almond|oat|soy|soya|coconut|rice|cashew|hemp|pea|plant[- ]based|plant|macadamia|flax) (?:milk|yogh?urt|cream|cheese|butter|kefir|latte|cappuccino)s?",
      "(?:peanut|almond|cashew|nut|seed|sunflower(?: seed)?|cocoa|apple|shea|pumpkin seed|hazelnut) butter",
      "dairy[- ]free \\w+", "vegan (?:cheese|butter|yogh?urt|cream|ice cream)", "butter beans?", "butter lettuce",
      "cream of tartar", "coconut cream", "nutritional yeast", "ice cream bean", "cream crackers?", "bean curd",
    ],
  },
  {
    id: "chicken",
    label: "chicken",
    terms: ["chicken", "hen", "rotisserie", "chicken breast", "chicken thigh", "chicken broth", "chicken stock", "wings"],
    safe: ["chicken[- ]free \\w+", "(?:vegan|plant[- ]based|meatless|mock|faux) chicken", "cauliflower wings", "buffalo cauliflower"],
  },
  {
    id: "poultry",
    label: "poultry",
    terms: ["poultry", "turkey", "duck", "goose", "quail", "pheasant"],
    includes: ["chicken"],
    safe: ["(?:vegan|plant[- ]based|tofu) turkey"],
  },
  {
    id: "fish",
    label: "fish",
    terms: [
      "fish", "salmon", "tuna", "cod", "tilapia", "mackerel", "sardine", "anchovy", "anchovies", "trout",
      "halibut", "haddock", "sea bass", "seabass", "pollock", "herring", "swordfish", "snapper", "catfish",
      "mahi mahi", "sole", "branzino", "hake", "caviar", "roe", "fish sauce", "fish oil", "worcestershire",
      "sushi", "sashimi", "bonito", "dashi", "surimi", "lox",
    ],
    safe: [
      "fish[- ]free \\w+", "(?:vegan|plant[- ]based) (?:fish|tuna|salmon)", "sole source", "fish-shaped",
      "(?:veggie|vegetable|avocado|cucumber|vegan) (?:sushi|rolls?)", "vegan worcestershire(?: sauce)?",
    ],
  },
  {
    id: "shellfish",
    label: "shellfish",
    terms: ["shellfish", "shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop", "crayfish", "langoustine", "krill"],
  },
  {
    id: "seafood",
    label: "seafood",
    terms: ["seafood", "squid", "calamari", "octopus"],
    includes: ["fish", "shellfish"],
  },
  {
    id: "eggs",
    label: "eggs",
    terms: ["egg", "egg white", "egg yolk", "omelet", "omelette", "frittata", "quiche", "shakshuka", "mayonnaise", "mayo", "meringue", "aioli", "custard", "brioche"],
    safe: ["eggplant", "egg[- ]free \\w+", "vegan (?:mayo|mayonnaise|aioli|omelet(?:te)?)", "(?:tofu|chickpea(?: flour)?) (?:omelet(?:te)?|scramble|frittata)"],
  },
  {
    id: "gluten",
    label: "gluten",
    terms: [
      "gluten", "wheat", "bread", "toast", "pasta", "spaghetti", "penne", "macaroni", "noodle", "couscous",
      "bulgur", "barley", "rye", "spelt", "semolina", "seitan", "flour", "bagel", "pita", "croissant",
      "cracker", "wrap", "tortilla wrap", "flour tortilla", "breadcrumbs", "panko", "muesli", "granola",
      "cereal", "soy sauce", "beer", "farro", "orzo", "pancake", "waffle", "muffin", "sandwich", "burger bun",
    ],
    safe: [
      "gluten[- ]free \\w+(?: \\w+)?", "rice (?:noodles?|flour|pasta|crackers?|cakes?|paper wraps?)", "buckwheat",
      "corn tortillas?", "(?:almond|coconut|chickpea|oat|cassava|tapioca|corn) flour", "lettuce wraps?",
      "(?:chickpea|lentil|bean|zucchini|konjac) (?:pasta|noodles?)", "tamari", "(?:collard|nori|rice paper) wraps?",
    ],
  },
  {
    id: "soy",
    label: "soy",
    terms: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "soy sauce", "tamari", "tvp", "textured vegetable protein", "soy milk", "natto"],
    safe: ["soy[- ]free \\w+"],
  },
  {
    id: "nuts",
    label: "tree nuts",
    terms: [
      "nut", "nuts", "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut",
      "pine nut", "mixed nuts", "nut butter", "praline", "marzipan", "nutella", "pesto", "almond milk", "trail mix",
    ],
    safe: ["nut[- ]free \\w+", "coconut", "nutmeg", "butternut", "(?:sunflower|pumpkin|seed)[- ]?(?:seed )?butter", "water chestnuts?", "tiger nuts?"],
    includes: ["peanuts"],
  },
  {
    id: "peanuts",
    label: "peanuts",
    terms: ["peanut", "peanut butter", "groundnut", "satay", "pb2"],
    safe: ["peanut[- ]free \\w+"],
  },
  {
    id: "red_meat",
    label: "red meat",
    terms: ["beef", "steak", "lamb", "veal", "mutton", "venison", "bison", "ground beef", "sirloin", "brisket", "goat meat", "burger patty"],
    safe: ["(?:vegan|plant[- ]based|beyond|impossible|veggie|bean|black bean|lentil|mushroom) (?:beef|burgers?|patty|patties|steaks?)", "cauliflower steaks?", "beefsteak tomato(?:es)?"],
  },
  {
    id: "pork",
    label: "pork",
    terms: ["pork", "bacon", "ham", "prosciutto", "salami", "pepperoni", "chorizo", "pancetta", "sausage", "lard", "gelatin", "gelatine", "hot dog"],
    safe: [
      "(?:turkey|chicken|beef|vegan|plant[- ]based|veggie|tofu|lamb) (?:bacon|ham|sausages?|pepperoni|salami|hot dogs?)",
      "(?:agar|vegan) gelatine?", "hamburger", "hamper",
    ],
  },
  {
    id: "meat",
    label: "meat",
    terms: ["meat", "meatball", "jerky", "mince", "minced meat", "bone broth", "burger", "kebab", "gyro", "deli slices"],
    safe: ["(?:vegan|plant[- ]based|meatless|mock|faux|veggie|bean|lentil|mushroom|black bean) (?:meat|meatballs?|mince|burgers?|kebabs?|jerky)", "meat[- ]free \\w+", "coconut meat"],
    includes: ["red_meat", "pork", "poultry", "chicken"],
  },
  {
    id: "animal_products",
    label: "animal products",
    terms: ["honey", "gelatin", "gelatine", "collagen", "bone broth"],
    includes: ["meat", "red_meat", "pork", "poultry", "chicken", "seafood", "fish", "shellfish", "dairy", "eggs"],
  },
];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRe(term: string): RegExp {
  const parts = term.split(" ").map(escapeRe).join("[\\s-]+");
  return new RegExp(`\\b${parts}(?:e?s)?\\b`, "i");
}

const TERM_RES = new Map<FoodCategoryId, RegExp[]>(
  CATEGORIES.map((c) => [c.id, [...c.terms].sort((a, b) => b.length - a.length).map(termRe)])
);
const SAFE_RES = new Map<FoodCategoryId, RegExp>(
  CATEGORIES.filter((c) => c.safe?.length).map((c) => [c.id, new RegExp(`\\b(?:${c.safe!.join("|")})\\b`, "gi")])
);
const RISKY_PROTEIN_RE = new RegExp(
  `\\bprotein (?:powder|shake|scoop|smoothie)s?\\b|\\bprotein\\b(?= (?:oats|pancakes?|pudding|yogh?urt))`,
  "i"
);
const PLANT_PROTEIN_RE = new RegExp(`\\b${PLANT_PROTEIN} protein\\b|\\bprotein \\(?(?:pea|plant|vegan|soy|rice)`, "i");

/** Expand a category set with the categories they imply (meat → poultry → chicken). */
export function expandCategories(ids: Iterable<FoodCategoryId>): FoodCategoryId[] {
  const out = new Set<FoodCategoryId>();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const inc of CATEGORY_BY_ID.get(id)?.includes ?? []) stack.push(inc);
  }
  return [...out];
}

/** Which categories a food text belongs to (safe phrases like "almond milk" ≠ dairy). */
export function foodCategoriesInText(text: string, among?: readonly FoodCategoryId[]): FoodCategoryId[] {
  const lower = ` ${text.toLowerCase()} `;
  const ids = among ?? CATEGORIES.map((c) => c.id);
  const hits: FoodCategoryId[] = [];
  for (const id of ids) {
    const safe = SAFE_RES.get(id);
    const cleaned = safe ? lower.replace(safe, " ") : lower;
    if (TERM_RES.get(id)!.some((re) => re.test(cleaned))) hits.push(id);
    else if (id === "dairy" && RISKY_PROTEIN_RE.test(cleaned) && !PLANT_PROTEIN_RE.test(cleaned)) hits.push(id);
  }
  return hits;
}

// ─── Extraction ─────────────────────────────────────────────────────────────

/** Why a food is excluded — all are enforced; severity drives wording and lifting. */
export type DietSeverity = "allergy" | "intolerance" | "dislike" | "restriction";

export type DietRule = {
  kind: "category" | "term";
  /** Category id or the custom term. */
  id: string;
  label: string;
  severity: DietSeverity;
  /** "profile" | "chat" | "semantic" (model-interpreted wording). */
  source: "profile" | "chat" | "semantic";
};

export type NutritionConstraints = {
  /** Hard-excluded categories (already expanded). */
  categories: FoodCategoryId[];
  /** Categories that come from allergies — never lifted by a casual request. */
  allergyCategories: FoodCategoryId[];
  /** Free-form foods to avoid (dislikes, "no mushrooms"). */
  customTerms: string[];
  dietStyle: string | null;
  /** Human notes (conflicts, lifted exclusions) for the coach. */
  notes: string[];
  /** Top-level rules with severity, for prompts and explanations. */
  rules?: DietRule[];
};

const USER_CATEGORY_TERMS: { re: RegExp; ids: FoodCategoryId[] }[] = [
  { re: /\bdairy\b|\blactose\b|\bmilk products?\b|\bbulmet\w*\b/, ids: ["dairy"] },
  { re: /\bchicken\b/, ids: ["chicken"] },
  { re: /\bpoultry\b|\bbirds?\b/, ids: ["poultry"] },
  { re: /\bseafood\b/, ids: ["seafood"] },
  { re: /\bshellfish\b|\bshrimps?\b|\bprawns?\b|\bcrustaceans?\b/, ids: ["shellfish"] },
  { re: /\bfish\b|\bpeshk\w*\b/, ids: ["fish"] },
  { re: /\beggs?\b|\bveze\b/, ids: ["eggs"] },
  { re: /\bgluten\b|\bwheat\b|\bceliac\b|\bcoeliac\b/, ids: ["gluten"] },
  { re: /\bsoy\b|\bsoya\b|\btofu\b/, ids: ["soy"] },
  { re: /\bpeanuts?\b/, ids: ["peanuts"] },
  { re: /\b(?:tree )?nuts?\b|\b(?:almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?|macadamias?)\b/, ids: ["nuts"] },
  { re: /\bred meat\b|\bbeef\b/, ids: ["red_meat"] },
  { re: /\bpork\b|\bbacon\b|\bham\b|\bmish derri\b/, ids: ["pork"] },
  { re: /\bmeats?\b|\bmish\b/, ids: ["meat"] },
  { re: /\banimal (?:products?|foods?)\b/, ids: ["animal_products"] },
];

const DIET_STYLE: { re: RegExp; style: string; ids: FoodCategoryId[] }[] = [
  { re: /\bvegan\b|\bplant[- ]based\b/, style: "vegan", ids: ["animal_products"] },
  { re: /\bvegetarian\b|\bveggie diet\b|\bvegjetarian\w*\b/, style: "vegetarian", ids: ["meat", "seafood"] },
  { re: /\bpescatarian\b|\bpescetarian\b/, style: "pescatarian", ids: ["meat"] },
  { re: /\bhalal\b/, style: "halal", ids: ["pork"] },
  { re: /\bkosher\b/, style: "kosher", ids: ["pork", "shellfish"] },
];

const NOT_FOOD_RE = /\b(?:time|oven|microwave|blender|kitchen|stove|fridge|money|budget|cooking|cook|meal prep|breakfast|lunch|dinner|snacks?|carbs?|calories|sugar|processed|junk|fast food|takeout|plan|menu|diet|week|day|days|meals?|option|options|recipes?|it|that|this|everything|anything|all|stuff|things?|variety)\b/;
const NOT_FOOD_EXACT_RE = /^(?:it|that|this|them|me|you|everything|anything|nothing|all|stuff|plan|the plan|my plan)$/;
const LIFT_RE = /\b(?:i (?:can|do|now) eat|i eat|i can have|i'?m (?:fine|ok|okay|good) with|i like|add(?: back)?|bring back|put back|include)\s+([a-z][a-z\s-]{1,30}?)(?=\s+(?:now|again|after all|too|as well|back)\b|[.,!?]|$)/g;
const LIFT_IS_FINE_RE = /\b([a-z][a-z\s-]{1,30}?)\s+(?:is|are)\s+(?:fine|ok|okay|good|back on the menu)(?:\s+(?:now|again|for me))?\b/g;

type SpanCandidate = { target: string; severity: DietSeverity };

/**
 * Natural phrasings the generic negation parser does not cover:
 * "milk doesn't work for me", "keep dairy out", "X upsets my stomach",
 * "lactose intolerant", "I can't stand mushrooms".
 */
const EXTRA_PATTERNS: { re: RegExp; severity: DietSeverity; fixed?: string }[] = [
  { re: /\b([a-z][a-z\s-]{1,30}?)\s+(?:doesn't|does not|don't|do not)\s+(?:work|agree|sit well|go well)\s+(?:for|with)\s+me\b/g, severity: "intolerance" },
  { re: /\b([a-z][a-z\s-]{1,30}?)\s+(?:upsets?|hurts?|wrecks?|messes? (?:up|with))\s+my\s+(?:stomach|gut|digestion|tummy)\b/g, severity: "intolerance" },
  { re: /\b([a-z][a-z\s-]{1,30}?)\s+(?:makes?|gives?)\s+me\s+(?:bloated|bloating|gas|gassy|cramps|sick|nauseous|a stomach ?ache|stomach ?aches|diarrh\w*|heartburn|reflux|hives|a rash|migraines?)\b/g, severity: "intolerance" },
  { re: /\bi\s+(?:react badly to|react to|am sensitive to|'m sensitive to|get sick from|can't digest|cannot digest|can't tolerate|cannot tolerate|don't tolerate|do not tolerate)\s+([a-z][a-z\s-]{1,30}?)(?=[.,!?;]|\s+(?:and|but|so)\b|$)/g, severity: "intolerance" },
  { re: /\b(lactose|gluten|dairy|egg|soy|nut|peanut|wheat|fish|shellfish)[\s-]+intoleran(?:t|ce)\b/g, severity: "intolerance" },
  { re: /\b(?:i'm|i am|i have|with)\s+(?:celiac|coeliac)(?: disease)?\b|\b(?:celiac|coeliac) disease\b/g, severity: "allergy", fixed: "gluten" },
  { re: /\bkeep\s+([a-z][a-z\s-]{1,30}?)\s+(?:out|away|off(?:\s+(?:the|my)\s+(?:plan|menu|list|plate))?)\b/g, severity: "restriction" },
  { re: /\b([a-z][a-z\s-]{1,25}?)\s+(?:stays?|is|are)\s+(?:out|off the menu|off the table|not an option)\b/g, severity: "restriction" },
  { re: /\b(?:stay away from|steer clear of|hold the|i'm off|i am off|i gave up|i've given up|i quit|i'm avoiding|i am avoiding|i stopped eating|i stopped drinking|i've cut out|i cut out|i've stopped eating|i no longer (?:eat|drink))\s+([a-z][a-z\s-]{1,30}?)(?=[.,!?;]|\s+(?:and|but|so|because)\b|$)/g, severity: "restriction" },
  { re: /\bi\s+(?:can't stand|cannot stand|detest|despise|loathe|really dislike)\s+([a-z][a-z\s-]{1,30}?)(?=[.,!?;]|\s+(?:and|but|so)\b|$)/g, severity: "dislike" },
  { re: /\b([a-z][a-z\s-]{1,25}?)\s+(?:is|are)\s+(?:gross|disgusting|nasty|awful|revolting)\b/g, severity: "dislike" },
];

function severityForSpan(kind: string, cue: string): DietSeverity {
  if (kind === "allergy") return /intoleran/.test(cue) ? "intolerance" : "allergy";
  if (kind === "dislike") return "dislike";
  return "restriction";
}

function categoriesInUserTarget(target: string): FoodCategoryId[] {
  const out = new Set<FoodCategoryId>();
  for (const t of USER_CATEGORY_TERMS) if (t.re.test(target)) t.ids.forEach((id) => out.add(id));
  return [...out];
}

function cleanTarget(piece: string): string {
  return piece
    .trim()
    .replace(/^(?:any|the|a|an|some|all|my|eating|drinking|having)\s+/, "")
    .replace(/\s+(?:at all|anymore|any more|please|either|too|for me|in it)$/, "")
    .trim();
}

function looksLikeFoodTerm(word: string): boolean {
  return (
    Boolean(word) &&
    word.split(/\s+/).length <= 3 &&
    /[a-z]/.test(word) &&
    !NOT_FOOD_RE.test(word) &&
    !NOT_FOOD_EXACT_RE.test(word)
  );
}

type ExtractEntry = {
  categories: Map<FoodCategoryId, DietSeverity>;
  custom: Map<string, DietSeverity>;
  lifted: Set<FoodCategoryId>;
  liftedCustom: Set<string>;
  style: string | null;
};

function addTarget(entry: ExtractEntry, rawPiece: string, severity: DietSeverity, strictFood: boolean) {
  const piece = cleanTarget(rawPiece);
  if (!piece) return;
  const ids = categoriesInUserTarget(piece);
  if (ids.length) {
    for (const id of ids) {
      const prev = entry.categories.get(id);
      if (!prev || SEVERITY_RANK[severity] > SEVERITY_RANK[prev]) entry.categories.set(id, severity);
    }
    return;
  }
  const term = strictFood ? trimToFood(piece) : piece;
  if (!term || !looksLikeFoodTerm(term)) return;
  entry.custom.set(term, severity);
}

/** Loose patterns capture leading words ("honestly mushrooms") — keep only the food. */
function trimToFood(piece: string): string | null {
  const words = piece.split(/\s+/);
  for (let k = 1; k <= Math.min(3, words.length); k++) {
    const suffix = words.slice(-k).join(" ");
    if (CUSTOM_FOOD_HINT_RE.test(suffix) && CUSTOM_FOOD_HINT_RE.exec(suffix)![0] === suffix) return suffix;
    if (foodCategoriesInText(suffix).length) return suffix;
  }
  const hint = piece.match(CUSTOM_FOOD_HINT_RE)?.[0];
  return hint ?? null;
}

const SEVERITY_RANK: Record<DietSeverity, number> = { dislike: 0, restriction: 1, intolerance: 2, allergy: 3 };

/** Everyday foods not covered by a category — lets loose phrasings ("keep X out") stay precise. */
const CUSTOM_FOOD_HINT_RE =
  /\b(?:mushrooms?|onions?|garlic|tomato(?:es)?|peppers?|spicy food|chil(?:i|li|ies)|olives?|avocados?|bananas?|oats?|rice|potato(?:es)?|beans?|lentils?|chickpeas?|broccoli|spinach|cabbage|coconut|sugar|honey|corn|peas|cucumbers?|eggplant|aubergine|zucchini|beets?|beetroot|kale|quinoa|cilantro|coriander|milk|cream|coffee|caffeine|alcohol|red meat|oranges?|apples?|berries|strawberr(?:y|ies)|grapes?|mango|pineapple|carrots?|celery|seeds?|sesame|mustard|mayo(?:nnaise)?|ketchup|sauces?|fried food|juice)\b/;

function extractFromText(text: string, opts?: { allowStyles?: boolean }): ExtractEntry {
  const entry: ExtractEntry = {
    categories: new Map(),
    custom: new Map(),
    lifted: new Set(),
    liftedCustom: new Set(),
    style: null,
  };
  const t = normalizeUserText(text);
  if (!t) return entry;

  let working = t;
  for (const p of EXTRA_PATTERNS) {
    p.re.lastIndex = 0;
    for (const m of t.matchAll(p.re)) {
      const target = p.fixed ?? (m[1] ?? "").trim();
      if (!target) continue;
      const candidates: SpanCandidate[] = splitTargetList(target).map((x) => ({ target: x, severity: p.severity }));
      for (const c of candidates) addTarget(entry, c.target, c.severity, !p.fixed);
      working = working.replace(m[0], " ");
    }
  }

  const parsed = parseConstraintText(working);
  for (const span of parsed.negated) {
    if (span.kind === "reduce" || span.kind === "inability" || span.kind === "lack") continue;
    const severity = severityForSpan(span.kind, span.cue);
    for (const piece of splitTargetList(span.target)) addTarget(entry, piece, severity, false);
  }
  if (opts?.allowStyles !== false) {
    for (const d of DIET_STYLE) {
      if (d.re.test(parsed.positive)) {
        entry.style = d.style;
        d.ids.forEach((id) => entry.categories.set(id, "restriction"));
      }
    }
  }
  const lifts = [...parsed.positive.matchAll(LIFT_RE), ...parsed.positive.matchAll(LIFT_IS_FINE_RE)];
  for (const m of lifts) {
    const target = cleanTarget(m[1]!);
    if (!target || /^(?:it|that|this|everything)$/.test(target)) continue;
    const ids = categoriesInUserTarget(target);
    if (ids.length) ids.forEach((id) => entry.lifted.add(id));
    else entry.liftedCustom.add(target);
  }
  return entry;
}

const ALLERGY_OPTION_MAP: Record<string, FoodCategoryId[]> = {
  dairy: ["dairy"],
  gluten: ["gluten"],
  nuts: ["nuts"],
  shellfish: ["shellfish"],
  eggs: ["eggs"],
  soy: ["soy"],
};

export type NutritionProfileInput = {
  diet_type?: string | null;
  food_allergies?: readonly string[] | null;
  food_dislikes?: string | null;
};

type SeverityMap = Map<string, { severity: DietSeverity; source: DietRule["source"] }>;

/** Lift `id`; broader bans containing it are split so siblings stay banned (vegetarian + chicken ≠ pork). */
function liftCategory(hard: Set<FoodCategoryId>, severity: SeverityMap, id: FoodCategoryId) {
  for (const x of expandCategories([id])) {
    hard.delete(x);
    severity.delete(`cat:${x}`);
  }
  for (const parent of CATEGORIES) {
    if (!hard.has(parent.id) || !expandCategories([parent.id]).includes(id)) continue;
    hard.delete(parent.id);
    const parentSeverity = severity.get(`cat:${parent.id}`);
    severity.delete(`cat:${parent.id}`);
    for (const sib of parent.includes ?? []) {
      if (!expandCategories([sib]).includes(id)) {
        hard.add(sib);
        const prev = severity.get(`cat:${sib}`);
        if (parentSeverity && (!prev || SEVERITY_RANK[parentSeverity.severity] >= SEVERITY_RANK[prev.severity])) {
          severity.set(`cat:${sib}`, parentSeverity);
        }
      }
    }
  }
}

/**
 * Merge profile + conversation (earlier → preferences → latest). Chat exclusions
 * persist; a later "I eat fish now" lifts a chat exclusion but never an allergy.
 */
export function resolveNutritionConstraints(
  profile: NutritionProfileInput,
  conversation: readonly string[] = [],
  preferences?: string | null
): NutritionConstraints {
  const notes: string[] = [];
  const allergy = new Set<FoodCategoryId>();
  const severity = new Map<string, { severity: DietSeverity; source: DietRule["source"] }>();
  const setSeverity = (key: string, s: DietSeverity, source: DietRule["source"]) => {
    const prev = severity.get(key);
    if (!prev || SEVERITY_RANK[s] >= SEVERITY_RANK[prev.severity]) severity.set(key, { severity: s, source });
  };
  for (const a of profile.food_allergies ?? []) {
    for (const id of ALLERGY_OPTION_MAP[a] ?? []) {
      allergy.add(id);
      setSeverity(`cat:${id}`, "allergy", "profile");
    }
  }
  const hard = new Set<FoodCategoryId>();
  const custom = new Set<string>();
  let dietStyle: string | null = null;

  const diet = (profile.diet_type ?? "").toLowerCase();
  const styleEntry = DIET_STYLE.find((d) => d.re.test(diet) || d.style === diet);
  if (styleEntry) {
    dietStyle = styleEntry.style;
    styleEntry.ids.forEach((id) => {
      hard.add(id);
      setSeverity(`cat:${id}`, "restriction", "profile");
    });
  }
  if (profile.food_dislikes?.trim()) {
    for (const piece of profile.food_dislikes.split(/[,;\n]|\band\b/)) {
      const p = normalizeUserText(piece).replace(/^(?:no|not|i (?:don't|do not) like|i hate)\s+/, "").trim();
      if (!p) continue;
      const ids = categoriesInUserTarget(p);
      if (ids.length) {
        ids.forEach((id) => {
          hard.add(id);
          setSeverity(`cat:${id}`, "dislike", "profile");
        });
      } else if (looksLikeFoodTerm(p)) {
        custom.add(p);
        setSeverity(`term:${p}`, "dislike", "profile");
      }
    }
  }

  const lift = (id: FoodCategoryId) => liftCategory(hard, severity, id);

  const texts = [...conversation.slice(0, -1), preferences ?? "", conversation.at(-1) ?? ""].filter((s) => s.trim());
  for (const text of texts) {
    const e = extractFromText(text);
    for (const id of e.lifted) {
      if (expandCategories([id]).some((x) => allergy.has(x))) {
        notes.push(`Kept ${CATEGORY_BY_ID.get(id)?.label ?? id} out — it's listed as an allergy. Ask the client to confirm before adding it.`);
        continue;
      }
      lift(id);
    }
    for (const c of e.liftedCustom) {
      if (foodCategoriesInText(c).some((id) => allergy.has(id))) {
        notes.push(`Kept ${c} out — it conflicts with a listed allergy. Ask the client to confirm before adding it.`);
        continue;
      }
      custom.delete(c);
      severity.delete(`term:${c}`);
    }
    if (e.style) dietStyle = e.style;
    for (const [id, s] of e.categories) {
      if (e.lifted.has(id)) continue;
      hard.add(id);
      if (s === "allergy") allergy.add(id);
      setSeverity(`cat:${id}`, s, "chat");
    }
    for (const [c, s] of e.custom) {
      custom.add(c);
      setSeverity(`term:${c}`, s, "chat");
    }
  }

  return finalizeConstraints(hard, allergy, custom, dietStyle, notes, severity);
}

function finalizeConstraints(
  hard: Set<FoodCategoryId>,
  allergy: Set<FoodCategoryId>,
  custom: Set<string>,
  dietStyle: string | null,
  notes: string[],
  severity: Map<string, { severity: DietSeverity; source: DietRule["source"] }>
): NutritionConstraints {
  const allergyCategories = expandCategories(allergy);
  const categories = expandCategories([...hard, ...allergy]);
  const customTerms = [...custom].filter((c) => !categories.some((id) => termMatchesCategory(c, id)));
  const top = categories.filter(
    (id) => !categories.some((p) => p !== id && CATEGORY_BY_ID.get(p)?.includes?.includes(id))
  );
  const rules: DietRule[] = [
    ...top.map((id) => {
      const s = severity.get(`cat:${id}`) ?? { severity: allergy.has(id) ? ("allergy" as const) : ("restriction" as const), source: "chat" as const };
      return { kind: "category" as const, id, label: CATEGORY_BY_ID.get(id)?.label ?? id, severity: s.severity, source: s.source };
    }),
    ...customTerms.map((term) => {
      const s = severity.get(`term:${term}`) ?? { severity: "restriction" as const, source: "chat" as const };
      return { kind: "term" as const, id: term, label: term, severity: s.severity, source: s.source };
    }),
  ];
  return { categories, allergyCategories, customTerms, dietStyle, notes, rules };
}

// ─── Semantic (model-interpreted) constraints ──────────────────────────────

export type SemanticDietaryItem = {
  food: string;
  category?: string | null;
  severity?: string | null;
  action?: string | null;
};

const VALID_CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const VALID_SEVERITIES = new Set<DietSeverity>(["allergy", "intolerance", "dislike", "restriction"]);

/** Parse the semantic extractor's JSON defensively (unknown shapes → []). */
export function parseSemanticDietaryItems(raw: unknown): SemanticDietaryItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  const out: SemanticDietaryItem[] = [];
  for (const item of list.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const food = typeof r.food === "string" ? r.food.trim().toLowerCase().slice(0, 40) : "";
    if (!food) continue;
    out.push({
      food,
      category: typeof r.category === "string" ? r.category.trim().toLowerCase() : null,
      severity: typeof r.severity === "string" ? r.severity.trim().toLowerCase() : null,
      action: typeof r.action === "string" ? r.action.trim().toLowerCase() : "exclude",
    });
  }
  return out;
}

function semanticCategories(item: SemanticDietaryItem): FoodCategoryId[] {
  return item.category && VALID_CATEGORY_IDS.has(item.category)
    ? [item.category as FoodCategoryId]
    : categoriesInUserTarget(normalizeUserText(item.food));
}

function termStem(term: string): string {
  return term.replace(/(?:oes|es|s)$/, "");
}

/**
 * The latest message must itself mention the food and must not exclude it —
 * the model's reading only resolves wording the rules don't cover.
 */
function allowIsGrounded(latest: string, target: { category?: FoodCategoryId; term?: string }): boolean {
  const t = normalizeUserText(latest);
  if (!t) return false;
  const e = extractFromText(latest, { allowStyles: false });
  if (target.category) {
    const id = target.category;
    const mentioned = categoriesInUserTarget(t).includes(id) || foodCategoriesInText(t, [id]).length > 0;
    const excludedAgain = [...e.categories.keys()].some((x) => expandCategories([x]).includes(id) || expandCategories([id]).includes(x));
    return mentioned && !excludedAgain;
  }
  const stem = termStem(target.term ?? "");
  if (stem.length < 3 || !t.includes(stem)) return false;
  return ![...e.custom.keys()].some((c) => c.includes(stem) || stem.includes(termStem(c)));
}

/**
 * Merge the semantic pass into the deterministic constraints.
 * - "exclude" items only ever ADD rules (never allergies — downgraded to intolerance).
 * - "allow" items lift a non-allergy rule only when the client's latest message
 *   mentions that food and doesn't exclude it (catches "fish is back on for me",
 *   "tani e ha peshkun" and other phrasings the rule parser misses).
 */
export function mergeSemanticConstraints(
  base: NutritionConstraints,
  items: readonly SemanticDietaryItem[],
  opts: { latestMessage?: string | null } = {}
): NutritionConstraints {
  const additions = items.filter((i) => (i.action ?? "exclude") === "exclude");
  const latest = opts.latestMessage?.trim() ?? "";
  const allows = latest ? items.filter((i) => i.action === "allow") : [];
  if (!additions.length && !allows.length) return base;
  const hard = new Set<FoodCategoryId>(base.categories);
  const allergy = new Set<FoodCategoryId>(base.allergyCategories);
  const custom = new Set<string>(base.customTerms);
  const severity: SeverityMap = new Map();
  for (const r of base.rules ?? []) severity.set(`${r.kind === "category" ? "cat" : "term"}:${r.id}`, { severity: r.severity, source: r.source });
  const notes = [...base.notes];
  let changed = false;

  for (const item of additions) {
    const parsedSev: DietSeverity = VALID_SEVERITIES.has(item.severity as DietSeverity) ? (item.severity as DietSeverity) : "restriction";
    // The model may not create allergies — only the client's own words can.
    const sev: DietSeverity = parsedSev === "allergy" ? "intolerance" : parsedSev;
    const cats = semanticCategories(item);
    if (cats.length) {
      for (const id of cats) {
        if (!hard.has(id)) changed = true;
        hard.add(id);
        if (!severity.has(`cat:${id}`)) severity.set(`cat:${id}`, { severity: sev, source: "semantic" });
      }
      continue;
    }
    const term = cleanTarget(normalizeUserText(item.food));
    if (!looksLikeFoodTerm(term) || custom.has(term)) continue;
    custom.add(term);
    severity.set(`term:${term}`, { severity: sev, source: "semantic" });
    changed = true;
  }

  for (const item of allows) {
    const cats = semanticCategories(item);
    if (cats.length) {
      for (const id of cats) {
        if (!hard.has(id)) continue;
        if (expandCategories([id]).some((x) => allergy.has(x))) {
          notes.push(`Kept ${CATEGORY_BY_ID.get(id)?.label ?? id} out — it's listed as an allergy. Ask the client to confirm before adding it.`);
          continue;
        }
        if (!allowIsGrounded(latest, { category: id })) continue;
        liftCategory(hard, severity, id);
        changed = true;
      }
      continue;
    }
    const term = cleanTarget(normalizeUserText(item.food));
    const stem = termStem(term);
    if (stem.length < 3) continue;
    for (const c of [...custom]) {
      const cs = termStem(c);
      if (cs !== stem && !c.includes(stem) && !term.includes(cs)) continue;
      if (foodCategoriesInText(c).some((id) => allergy.has(id))) continue;
      if (!allowIsGrounded(latest, { term: c })) continue;
      custom.delete(c);
      severity.delete(`term:${c}`);
      changed = true;
    }
  }
  if (!changed) return base;
  return finalizeConstraints(hard, allergy, custom, base.dietStyle, notes, severity);
}

function termMatchesCategory(term: string, id: FoodCategoryId): boolean {
  return foodCategoriesInText(term, [id]).length > 0;
}

export function hasNutritionConstraints(c: NutritionConstraints): boolean {
  return c.categories.length > 0 || c.customTerms.length > 0;
}

const SEVERITY_LABEL: Record<DietSeverity, string> = {
  allergy: "ALLERGY — strict safety rule, avoid traces and derivatives",
  intolerance: "INTOLERANCE — exclude (the client reacts badly to it)",
  dislike: "DISLIKE — exclude (preference, not medical)",
  restriction: "EXCLUDED — the client said no",
};

/** Prompt block with hard food rules. */
export function buildNutritionConstraintPromptBlock(c: NutritionConstraints): string {
  if (!hasNutritionConstraints(c)) return "";
  const lines = ["HARD FOOD CONSTRAINTS (never violate — they override variety, macros and taste):"];
  const labels = (ids: readonly FoodCategoryId[]) =>
    ids.map((id) => CATEGORY_BY_ID.get(id)?.label ?? id).join(", ");
  const top = c.categories.filter((id) => !c.categories.some((p) => p !== id && CATEGORY_BY_ID.get(p)?.includes?.includes(id)));
  if (top.length) lines.push(`- Exclude completely: ${labels(top)}.`);
  if (c.rules?.length) {
    for (const sev of ["allergy", "intolerance", "restriction", "dislike"] as const) {
      const items = c.rules.filter((r) => r.severity === sev).map((r) => r.label);
      if (items.length) lines.push(`- ${SEVERITY_LABEL[sev]}: ${items.join(", ")}.`);
    }
  }
  if (c.categories.includes("dairy")) {
    lines.push("- No dairy means NO milk, cheese, yogurt, butter, cream, ghee, kefir, whey or casein (incl. whey protein powder). Use eggs, meat, fish, tofu, legumes, olive oil, and unsweetened soy/oat milk if a milk is needed.");
  }
  if (c.categories.includes("chicken")) {
    lines.push("- No chicken in ANY form: breast, thighs, wings, broth/stock, sausages, deli slices.");
  }
  if (c.categories.includes("fish")) {
    lines.push("- No fish in any form, including tuna, salmon, anchovies, fish sauce, fish oil and Worcestershire sauce.");
  }
  if (c.categories.includes("eggs")) {
    lines.push("- No eggs in any form: omelettes, egg whites, mayonnaise, baked goods made with egg.");
  }
  if (c.categories.includes("gluten")) {
    lines.push("- Gluten-free: no wheat/barley/rye bread, pasta, couscous, regular soy sauce; use rice, quinoa, potatoes, certified gluten-free oats.");
  }
  if (c.allergyCategories.length) {
    const topAllergy = c.allergyCategories.filter(
      (id) => !c.allergyCategories.some((p) => p !== id && CATEGORY_BY_ID.get(p)?.includes?.includes(id))
    );
    lines.push(`- ALLERGIES (${labels(topAllergy)}): avoid traces and derivatives too.`);
  }
  if (c.customTerms.length) lines.push(`- Also avoid: ${c.customTerms.join(", ")}.`);
  if (c.dietStyle) lines.push(`- Diet style: ${c.dietStyle}.`);
  lines.push("- Never sneak an excluded food into sauces, dressings, snacks or secondary ingredients. Check every meal name, description and ingredient.");
  return lines.join("\n");
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type FoodViolation = {
  where: "meal" | "ingredient" | "grocery";
  slot?: AiNutritionMeal["slot"];
  item: string;
  reason: string;
};

function customTermRe(term: string): RegExp {
  const stem = term.replace(/(?:es|s)$/, "");
  return new RegExp(`\\b${escapeRe(stem).replace(/\s+/g, "[\\s-]+")}(?:e?s)?\\b`, "i");
}

const WHEY_TERM_RE = /^(?:whey|casein)(?: protein)?(?: powder)?$/;

function excludesWhey(c: NutritionConstraints): boolean {
  return c.customTerms.some((t) => WHEY_TERM_RE.test(t));
}

function isRiskyProtein(text: string): boolean {
  return RISKY_PROTEIN_RE.test(text) && !PLANT_PROTEIN_RE.test(text);
}

function safePhrasesFor(term: string): RegExp[] {
  const stem = term.toLowerCase().replace(/(?:es|s)$/, "");
  return CATEGORIES.filter((cat) =>
    cat.terms.some((t) => t === term || t === stem || t.replace(/(?:es|s)$/, "") === stem)
  )
    .map((cat) => SAFE_RES.get(cat.id))
    .filter((re): re is RegExp => Boolean(re));
}

/** A custom term that is also a category word ("milk") inherits that category's safe phrases ("almond milk"). */
function customTermMatches(term: string, text: string): boolean {
  let cleaned = ` ${text.toLowerCase()} `;
  const stem = term.toLowerCase().replace(/(?:es|s)$/, "");
  for (const cat of CATEGORIES) {
    if (!cat.terms.some((t) => t === term || t === stem || t.replace(/(?:es|s)$/, "") === stem)) continue;
    const safe = SAFE_RES.get(cat.id);
    if (safe) cleaned = cleaned.replace(safe, " ");
  }
  return customTermRe(term).test(cleaned);
}

function textViolation(text: string, c: NutritionConstraints): string | null {
  const cats = foodCategoriesInText(text, c.categories);
  if (cats.length) return CATEGORY_BY_ID.get(cats[0]!)?.label ?? cats[0]!;
  const term = c.customTerms.find((t) => customTermMatches(t, text));
  if (term) return term;
  if (excludesWhey(c) && isRiskyProtein(text)) return "whey (protein powder)";
  return null;
}

/** True when a food text breaks none of the constraints. */
export function foodTextAllowed(text: string, c: NutritionConstraints): boolean {
  return textViolation(text, c) === null;
}

/** Which rule a food text breaks (label), or null. */
export function foodTextViolation(text: string, c: NutritionConstraints): string | null {
  return textViolation(text, c);
}

export function findFoodViolations(plan: AiGeneratedNutritionPlan, c: NutritionConstraints): FoodViolation[] {
  if (!hasNutritionConstraints(c)) return [];
  const out: FoodViolation[] = [];
  for (const meal of plan.meals) {
    const mealReason = textViolation(`${meal.name} ${meal.description ?? ""}`, c);
    if (mealReason) out.push({ where: "meal", slot: meal.slot, item: meal.name, reason: mealReason });
    for (const ing of meal.ingredients ?? []) {
      const reason = textViolation(ing.name, c);
      if (reason) out.push({ where: "ingredient", slot: meal.slot, item: ing.name, reason });
    }
  }
  for (const g of plan.grocery_list ?? []) {
    const reason = textViolation(g.name, c);
    if (reason) out.push({ where: "grocery", item: g.name, reason });
  }
  return out;
}

export function formatFoodViolationsForPrompt(v: readonly FoodViolation[]): string {
  return v
    .slice(0, 12)
    .map((x) => `- ${x.where}${x.slot ? ` (${x.slot})` : ""}: "${x.item}" contains ${x.reason}`)
    .join("\n");
}

// ─── Deterministic substitution ────────────────────────────────────────────

type Swap = { re: RegExp; to: string[] };

/** Ordered: specific phrases first. `to` = candidates, first allowed wins. */
const SWAPS: Partial<Record<FoodCategoryId, Swap[]>> = {
  dairy: [
    { re: /\bwhey(?: protein)?(?: isolate)?(?: powder)?\b|\bcasein(?: protein)?\b|\bprotein powder\b|\bprotein shake\b/gi, to: ["plain Greek yogurt", "eggs", "firm tofu", "lentils"] },
    { re: /\bgreek yogh?urt\b|\byogh?urt\b|\bskyr\b|\bquark\b/gi, to: ["plain soy yogurt", "coconut yogurt"] },
    { re: /\bcottage cheese\b|\bricotta\b|\bcream cheese\b/gi, to: ["silken tofu", "hummus"] },
    { re: /\b(?:(?:cheddar|mozzarella|parmesan|feta|halloumi|goat|blue|swiss|grated|shredded) cheese|cheddar|mozzarella|parmesan|feta|halloumi|cheese)\b/gi, to: ["nutritional yeast", "avocado"] },
    { re: /\bbuttermilk\b|\bmilk\b/gi, to: ["oat milk", "rice milk", "coconut milk"] },
    { re: /\bghee\b|\bbutter\b/gi, to: ["olive oil"] },
    { re: /\bsour cream\b|\bwhipped cream\b|\bcream\b/gi, to: ["coconut cream"] },
    { re: /\bkefir\b/gi, to: ["coconut yogurt"] },
    { re: /\bice cream\b/gi, to: ["frozen banana"] },
    { re: /\btzatziki\b/gi, to: ["hummus"] },
    { re: /\blatte\b|\bcappuccino\b/gi, to: ["oat latte"] },
  ],
  chicken: [
    { re: /\bchicken (?:broth|stock)\b/gi, to: ["vegetable broth"] },
    { re: /\bchicken(?: breasts?| thighs?| drumsticks?| tenders?| strips?| mince)?\b|\brotisserie\b/gi, to: ["turkey breast", "lean beef", "tofu", "lentils"] },
  ],
  poultry: [
    { re: /\b(?:turkey|duck|goose|quail)(?: breasts?| mince| slices)?\b/gi, to: ["lean beef", "tofu", "lentils"] },
  ],
  fish: [
    { re: /\bfish sauce\b|\bworcestershire(?: sauce)?\b/gi, to: ["coconut aminos", "soy sauce"] },
    { re: /\bfish oil\b/gi, to: ["algae oil"] },
    { re: /\b(?:salmon|tuna|cod|tilapia|mackerel|sardines?|anchov(?:y|ies)|trout|halibut|haddock|sea ?bass|pollock|herring|white fish|fish)(?: fillets?| steaks?)?\b/gi, to: ["chicken breast", "lean beef", "tofu", "lentils"] },
  ],
  shellfish: [
    { re: /\b(?:shrimps?|prawns?|crab|lobster|scallops?|mussels?|clams?|oysters?)\b/gi, to: ["chicken breast", "tofu", "chickpeas"] },
  ],
  seafood: [{ re: /\b(?:squid|calamari|octopus|seafood)\b/gi, to: ["chicken breast", "tofu", "chickpeas"] }],
  eggs: [
    { re: /\bmayo(?:nnaise)?\b|\baioli\b/gi, to: ["mashed avocado", "hummus"] },
    { re: /\b(?:scrambled |boiled |fried |poached )?eggs?(?: whites?| yolks?)?\b|\bomelet(?:te)?\b|\bfrittata\b/gi, to: ["tofu scramble", "chickpea-flour scramble"] },
  ],
  gluten: [
    { re: /\bsoy sauce\b/gi, to: ["tamari", "coconut aminos"] },
    { re: /\b(?:whole ?wheat |wholegrain |sourdough |white |rye )?(?:bread|toast)\b/gi, to: ["gluten-free bread", "rice cakes"] },
    { re: /\b(?:whole ?wheat )?(?:pasta|spaghetti|penne|macaroni|orzo)\b/gi, to: ["rice pasta", "chickpea pasta"] },
    { re: /\bcouscous\b|\bbulgur\b|\bfarro\b|\bbarley\b/gi, to: ["quinoa", "brown rice"] },
    { re: /\b(?:flour |wheat )?(?:tortilla )?wraps?\b|\bflour tortillas?\b|\bpita\b|\bbagels?\b/gi, to: ["corn tortillas", "lettuce wraps"] },
    { re: /\bnoodles?\b/gi, to: ["rice noodles"] },
    { re: /\bcrackers?\b/gi, to: ["rice cakes"] },
    { re: /\b(?:wheat )?flour\b/gi, to: ["rice flour", "oat flour"] },
    { re: /\bgranola\b|\bmuesli\b|\bcereal\b/gi, to: ["gluten-free oats"] },
  ],
  soy: [
    { re: /\bsoy sauce\b|\btamari\b/gi, to: ["coconut aminos"] },
    { re: /\bsoy milk\b/gi, to: ["oat milk", "rice milk"] },
    { re: /\bsilken tofu\b|\btofu(?: scramble)?\b/gi, to: ["chickpeas", "lentils", "lean beef"] },
    { re: /\btempeh\b/gi, to: ["lentils", "chickpeas"] },
    { re: /\bedamame\b/gi, to: ["green peas"] },
  ],
  peanuts: [{ re: /\bpeanut butter\b|\bpeanuts?\b|\bsatay\b/gi, to: ["sunflower seed butter", "pumpkin seeds"] }],
  nuts: [
    { re: /\b(?:almond|cashew|hazelnut|nut) butter\b|\bnutella\b/gi, to: ["sunflower seed butter"] },
    { re: /\balmond milk\b/gi, to: ["oat milk", "rice milk"] },
    { re: /\b(?:mixed nuts|trail mix)\b|\b(?:almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?|macadamias?|pine nuts?|brazil nuts?)\b/gi, to: ["pumpkin seeds", "sunflower seeds"] },
    { re: /\bpesto\b/gi, to: ["basil-olive oil sauce"] },
  ],
  pork: [
    { re: /\bbacon\b/gi, to: ["turkey bacon", "smoked tempeh"] },
    { re: /\bham\b|\bprosciutto\b|\bsalami\b|\bpepperoni\b|\bchorizo\b|\bpancetta\b/gi, to: ["turkey slices", "chicken slices", "hummus"] },
    { re: /\bpork(?: loin| chops?| tenderloin| mince)?\b|\bsausages?\b/gi, to: ["chicken breast", "lean beef", "lentils"] },
    { re: /\blard\b/gi, to: ["olive oil"] },
    { re: /\bgelatine?\b/gi, to: ["agar"] },
  ],
  red_meat: [
    { re: /\b(?:lean |ground |minced )?(?:beef|steak|lamb|veal|mutton|venison|bison|sirloin|brisket)(?: mince| strips?)?\b/gi, to: ["chicken breast", "turkey breast", "tofu", "lentils"] },
  ],
  meat: [
    { re: /\bmeatballs?\b/gi, to: ["lentil balls"] },
    { re: /\b(?:minced meat|mince|meat|jerky|burger)\b/gi, to: ["tofu", "lentils", "chickpeas"] },
    { re: /\bbone broth\b/gi, to: ["vegetable broth"] },
  ],
  animal_products: [
    { re: /\bhoney\b/gi, to: ["maple syrup"] },
    { re: /\bcollagen\b/gi, to: ["lentils"] },
  ],
};

function allowed(text: string, c: NutritionConstraints): boolean {
  return textViolation(text, c) === null;
}

function applySwaps(text: string, c: NutritionConstraints, changes: Set<string>): string {
  let out = text;
  const swapCategories: FoodCategoryId[] = excludesWhey(c) && !c.categories.includes("dairy")
    ? [...c.categories, "dairy"]
    : c.categories;
  const kept: string[] = [];
  const unmask = (s: string) => s.replace(/\u0001(\d+)\u0001/g, (_, i: string) => kept[Number(i)]!);
  for (const id of swapCategories) {
    const swaps = id === "dairy" && !c.categories.includes("dairy") ? SWAPS.dairy!.slice(0, 1) : SWAPS[id] ?? [];
    const safe = SAFE_RES.get(id);
    if (safe) {
      out = out.replace(safe, (m) => (allowed(m, c) ? `\u0001${kept.push(m) - 1}\u0001` : m));
    }
    for (const swap of swaps) {
      out = out.replace(swap.re, (match) => {
        if (allowed(match, c)) return match;
        const to = swap.to.find((cand) => allowed(cand, c));
        if (!to) return match;
        changes.add(`${match.toLowerCase()} → ${to}`);
        return to;
      });
    }
  }
  out = unmask(out);
  for (const term of c.customTerms) {
    if (!customTermMatches(term, out)) continue;
    const kept: string[] = [];
    const masked = safePhrasesFor(term).reduce(
      (acc, safe) => acc.replace(safe, (m) => `\u0000${kept.push(m) - 1}\u0000`),
      out
    );
    const re = new RegExp(customTermRe(term).source, "gi");
    changes.add(`removed ${term}`);
    out = masked
      .replace(re, " ")
      .replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)]!)
      .replace(/\s+(?:and|with|&)\s*$/i, "")
      .replace(/^\s*(?:and|with|&)\s+/i, "");
  }
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  if (/^[A-Z]/.test(text) && /^[a-z]/.test(out)) out = out[0]!.toUpperCase() + out.slice(1);
  return out;
}

const SLOT_LABEL: Record<AiNutritionMeal["slot"], string> = {
  breakfast: "Breakfast",
  snack_1: "Morning snack",
  lunch: "Lunch",
  snack_2: "Afternoon snack",
  dinner: "Dinner",
};

/**
 * Deterministically swap/remove anything that breaks the constraints.
 * Macros stay as generated (approximate after swaps) — a coach note says so.
 */
export function autoFixNutritionPlan(
  plan: AiGeneratedNutritionPlan,
  c: NutritionConstraints
): { plan: AiGeneratedNutritionPlan; changes: string[] } {
  if (!hasNutritionConstraints(c)) return { plan, changes: [] };
  const changes = new Set<string>();
  const meals = plan.meals.map((meal) => {
    let name = applySwaps(meal.name, c, changes);
    if (!name || !allowed(name, c)) name = `${SLOT_LABEL[meal.slot]} bowl`;
    let description = meal.description ? applySwaps(meal.description, c, changes) : meal.description;
    if (description && !allowed(description, c)) description = "";
    const ingredients = (meal.ingredients ?? [])
      .map((ing) => ({ ...ing, name: applySwaps(ing.name, c, changes) }))
      .filter((ing) => {
        const ok = ing.name && allowed(ing.name, c);
        if (!ok) changes.add(`dropped ${ing.name || "an ingredient"}`);
        return ok;
      });
    return { ...meal, name, description, ingredients };
  });
  const seenGrocery = new Set<string>();
  const grocery_list = (plan.grocery_list ?? [])
    .map((g) => ({ ...g, name: applySwaps(g.name, c, changes) }))
    .filter((g) => {
      const key = g.name.toLowerCase();
      if (!g.name || !allowed(g.name, c) || seenGrocery.has(key)) return false;
      seenGrocery.add(key);
      return true;
    });
  const list = [...changes];
  const notes = list.length
    ? [
        `Adjusted to your food rules: ${list.slice(0, 6).join("; ")}${list.length > 6 ? "…" : ""}.`,
        ...plan.coach_notes,
      ]
    : plan.coach_notes;
  return { plan: { ...plan, meals, grocery_list, coach_notes: notes }, changes: list };
}
