/**
 * Download and slim the open-source exercemus exercise catalog.
 * Source: https://github.com/exercemus/exercises (MIT code; per-exercise licenses apply)
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL =
  "https://raw.githubusercontent.com/exercemus/exercises/minified/minified-exercises.json";
const OUT_PATH = resolve(__dirname, "../src/data/exercise-catalog.json");

const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`Failed to fetch catalog: ${res.status}`);
  process.exit(1);
}

const data = await res.json();

const catalog = {
  source: "https://github.com/exercemus/exercises",
  attribution:
    "Exercise data curated from exercemus, wger.de, and exercises.json. See each exercise license in the source repo.",
  categories: data.categories ?? [],
  equipment: data.equipment ?? [],
  muscles: data.muscles ?? [],
  muscle_groups: data.muscle_groups ?? {},
  exercises: (data.exercises ?? []).map((ex) => ({
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment ?? [],
    primary_muscles: ex.primary_muscles ?? [],
    secondary_muscles: ex.secondary_muscles ?? [],
    description: ex.description ?? null,
    instructions: ex.instructions ?? [],
    video: ex.video ?? null,
  })),
};

writeFileSync(OUT_PATH, JSON.stringify(catalog));
console.log(`Wrote ${catalog.exercises.length} exercises to ${OUT_PATH}`);
