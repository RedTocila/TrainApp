/**
 * Download and convert the open recipe dataset (13k recipes).
 * Source: https://github.com/josephrmartinez/recipe-dataset (CC BY-SA 3.0)
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL =
  "https://raw.githubusercontent.com/josephrmartinez/recipe-dataset/main/13k-recipes.csv";
const OUT_PATH = resolve(__dirname, "../src/data/recipe-catalog.json");

const MEAL_KEYWORDS = {
  breakfast: [
    "breakfast",
    "oatmeal",
    "pancake",
    "waffle",
    "omelet",
    "omelette",
    "french toast",
    "granola",
    "smoothie",
    "muffin",
    "cereal",
    "bagel",
    "croissant",
    "frittata",
    "shakshuka",
    "porridge",
  ],
  snack: [
    "snack",
    "cookie",
    "brownie",
    "bar",
    "dip",
    "bite",
    "chips",
    "popcorn",
    "trail mix",
    "cracker",
    "nuts",
  ],
  lunch: ["soup", "salad", "sandwich", "wrap", "bowl", "lunch", "taco", "burger"],
  dinner: [
    "dinner",
    "roast",
    "steak",
    "casserole",
    "curry",
    "stew",
    "pasta",
    "lasagna",
    "risotto",
    "chicken",
    "salmon",
    "shrimp",
  ],
};

function parseIngredientList(raw) {
  if (!raw?.trim()) return [];
  const items = [];
  const re = /'((?:\\'|[^'])*)'/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const name = match[1].replace(/\\'/g, "'").trim();
    if (name) items.push({ name, amount: "" });
  }
  if (items.length > 0) return items;

  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((name) => ({ name, amount: "" }));
}

function inferMealType(title, ingredients) {
  const text = `${title} ${ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
  for (const [mealType, keywords] of Object.entries(MEAL_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return mealType;
  }
  return "lunch";
}

function truncate(text, max = 280) {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

console.log("Downloading recipe dataset…");
const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`Failed to fetch CSV: ${res.status}`);
  process.exit(1);
}

const csv = await res.text();
const rows = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
});

const recipes = rows
  .map((row, index) => {
    const title = (row.Title ?? row.title ?? "").trim();
    if (!title) return null;

    const ingredientsRaw = row.Cleaned_Ingredients || row.Ingredients || "";
    const ingredients = parseIngredientList(ingredientsRaw);
    const instructions = (row.Instructions ?? row.instructions ?? "").trim();
    const id = String(row.id ?? row[""] ?? index);

    return {
      id,
      title,
      meal_type: inferMealType(title, ingredients),
      ingredients,
      instructions,
      description: truncate(instructions, 220),
    };
  })
  .filter(Boolean);

const catalog = {
  source: "https://github.com/josephrmartinez/recipe-dataset",
  attribution:
    "Recipe data from josephrmartinez/recipe-dataset (Epicurious scrape, CC BY-SA 3.0).",
  count: recipes.length,
  recipes,
};

writeFileSync(OUT_PATH, JSON.stringify(catalog));
console.log(`Wrote ${recipes.length} recipes to ${OUT_PATH}`);
