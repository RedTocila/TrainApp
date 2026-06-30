/**
 * Download and normalize the ExerciseDB exercise catalog.
 * Free tier: https://oss.exercisedb.dev (1,500 exercises, GIF demos)
 * Optional V2 (gender-specific media): set RAPIDAPI_KEY + subscribe on RapidAPI
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../src/data/exercise-catalog.json");

const V1_BASE = "https://oss.exercisedb.dev/api/v1";
const V2_HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";
const V2_BASE = `https://${V2_HOST}/api/v1`;

const PAGE_SIZE = 50;
const PAGE_DELAY_MS = 1200;
const MAX_RETRIES = 6;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ");
}

function cleanInstructions(steps) {
  return (steps ?? []).map((step) =>
    String(step)
      .replace(/^Step:\d+\s*/i, "")
      .trim()
  );
}

function pickGifUrl(exercise) {
  const gifs = exercise.gifUrls;
  if (gifs && typeof gifs === "object") {
    return (
      gifs["1080p"] ??
      gifs["720p"] ??
      gifs["480p"] ??
      gifs["360p"] ??
      null
    );
  }
  if (exercise.gifUrl) return exercise.gifUrl;
  return null;
}

function stripModifiers(name) {
  return name
    .replace(/\s*-\s*.*variation.*$/i, "")
    .replace(/\s+with\s+.+$/i, "")
    .replace(
      /\s+(inclined|elevated|pure|focused|horizontal|classic|powerful|simple|lateral|seated|athletic style)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a, b) {
  const wa = new Set(normalizeName(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const word of wa) {
    if (wb.has(word)) shared += 1;
  }
  return shared / Math.max(wa.size, wb.size);
}

function findFallbackGifUrl(exercise, validByName, validExercises) {
  const stripped = stripModifiers(exercise.name);
  const attempts = [normalizeName(stripped)];
  const words = stripped.split(/\s+/).filter(Boolean);
  for (let len = words.length - 1; len >= 2; len--) {
    attempts.push(normalizeName(words.slice(0, len).join(" ")));
  }

  for (const key of attempts) {
    const hit = validByName.get(key);
    if (hit?.gif_url) return hit.gif_url;
  }

  let bestUrl = null;
  let bestScore = 0.5;
  for (const other of validExercises) {
    if (other.id === exercise.id) continue;
    const sharedBody = exercise.body_parts.some((bp) =>
      other.body_parts.includes(bp)
    );
    const sharedEquipment = exercise.equipment.some((eq) =>
      other.equipment.includes(eq)
    );
    const nameScore = nameSimilarity(exercise.name, other.name);
    const score =
      nameScore * (sharedBody ? 1.2 : 0.85) * (sharedEquipment ? 1.1 : 1);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = other.gif_url;
    }
  }

  return bestUrl;
}

async function urlExists(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function validateAndRepairGifs(exercises) {
  console.log("Validating GIF URLs…");
  const concurrency = 12;
  let checked = 0;
  let repaired = 0;
  let removed = 0;
  let idx = 0;

  async function checkOne(exercise) {
    const urls = [
      exercise.gif_url,
      exercise.gifs?.male,
      exercise.gifs?.female,
    ].filter(Boolean);

    const valid = new Map();
    for (const url of urls) {
      if (!(await urlExists(url))) continue;
      valid.set(url, true);
    }

    exercise.gif_url = exercise.gif_url && valid.has(exercise.gif_url)
      ? exercise.gif_url
      : null;
    if (exercise.gifs?.male && !valid.has(exercise.gifs.male)) {
      delete exercise.gifs.male;
    }
    if (exercise.gifs?.female && !valid.has(exercise.gifs.female)) {
      delete exercise.gifs.female;
    }

    if (!exercise.gif_url && !exercise.gifs?.male && !exercise.gifs?.female) {
      exercise._needsFallback = true;
    }

    checked += 1;
    if (checked % 100 === 0) {
      process.stdout.write(`\rValidated ${checked}/${exercises.length}`);
    }
  }

  async function worker() {
    while (idx < exercises.length) {
      const i = idx++;
      await checkOne(exercises[i]);
      await sleep(40);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stdout.write("\n");

  const validExercises = exercises.filter(
    (ex) => ex.gif_url || ex.gifs?.male || ex.gifs?.female
  );
  const validByName = new Map();
  for (const ex of validExercises) {
    validByName.set(normalizeName(ex.name), ex);
  }

  for (const exercise of exercises) {
    if (!exercise._needsFallback) continue;
    delete exercise._needsFallback;

    const fallback = findFallbackGifUrl(exercise, validByName, validExercises);
    if (fallback) {
      exercise.gif_url = fallback;
      exercise.gif_fallback_url = fallback;
      repaired += 1;
    } else {
      removed += 1;
    }
  }

  console.log(
    `GIF repair: ${repaired} fallbacks assigned, ${removed} exercises without demos`
  );

  return exercises;
}

function pickVideoUrl(exercise) {
  if (typeof exercise.videoUrl === "string" && exercise.videoUrl.trim()) {
    return exercise.videoUrl.trim();
  }
  return null;
}

async function fetchJson(url, headers = {}, attempt = 0) {
  const res = await fetch(url, { headers });
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const waitMs = PAGE_DELAY_MS * (attempt + 2);
    process.stdout.write(`\nRate limited — waiting ${waitMs}ms…`);
    await sleep(waitMs);
    return fetchJson(url, headers, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch failed ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllV1() {
  const all = [];
  let after = null;

  while (true) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (after) params.set("after", after);

    const json = await fetchJson(`${V1_BASE}/exercises?${params}`);
    all.push(...(json.data ?? []));

    process.stdout.write(`\rV1: ${all.length}/${json.meta?.total ?? "?"} exercises`);

    if (!json.meta?.hasNextPage) break;
    after = json.meta.nextCursor;
    await sleep(PAGE_DELAY_MS);
  }

  process.stdout.write("\n");
  return all;
}

async function fetchAllV2(apiKey) {
  const all = [];
  let after = null;

  while (true) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (after) params.set("after", after);

    const json = await fetchJson(`${V2_BASE}/exercises?${params}`, {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": V2_HOST,
    });
    all.push(...(json.data ?? []));

    process.stdout.write(`\rV2: ${all.length}/${json.meta?.total ?? "?"} exercises`);

    if (!json.meta?.hasNextPage) break;
    after = json.meta.nextCursor;
    await sleep(PAGE_DELAY_MS);
  }

  process.stdout.write("\n");
  return all;
}

function mergeExerciseRecords(records) {
  /** @type {Map<string, object>} */
  const byName = new Map();

  for (const raw of records) {
    const name = String(raw.name ?? "").trim();
    if (!name) continue;

    const key = normalizeName(name);
    const gender =
      raw.gender === "male" || raw.gender === "female" ? raw.gender : null;
    const gifUrl = pickGifUrl(raw);
    const videoUrl = pickVideoUrl(raw);

    const existing = byName.get(key) ?? {
      id: raw.exerciseId ?? key,
      name,
      body_parts: [],
      equipment: [],
      primary_muscles: [],
      secondary_muscles: [],
      description: null,
      instructions: [],
      gif_url: null,
      gif_fallback_url: null,
      gifs: {},
      video_url: null,
    };

    existing.id = existing.id || raw.exerciseId;
    existing.body_parts = [
      ...new Set([...existing.body_parts, ...(raw.bodyParts ?? [])]),
    ];
    existing.equipment = [
      ...new Set([...existing.equipment, ...(raw.equipments ?? [])]),
    ];
    existing.primary_muscles = [
      ...new Set([...existing.primary_muscles, ...(raw.targetMuscles ?? [])]),
    ];
    existing.secondary_muscles = [
      ...new Set([...existing.secondary_muscles, ...(raw.secondaryMuscles ?? [])]),
    ];

    const overview = raw.overview?.trim();
    if (overview && !existing.description) existing.description = overview;

    const instructions = cleanInstructions(raw.instructions);
    if (instructions.length > existing.instructions.length) {
      existing.instructions = instructions;
    }

    if (gifUrl) {
      if (gender) {
        existing.gifs[gender] = gifUrl;
      } else if (!existing.gif_url) {
        existing.gif_url = gifUrl;
      }
      if (!existing.gif_url) existing.gif_url = gifUrl;
    }

    if (videoUrl && !existing.video_url) {
      existing.video_url = videoUrl;
    }

    byName.set(key, existing);
  }

  return [...byName.values()].map((exercise) => ({
    ...exercise,
    category: exercise.body_parts[0] ?? "general",
    gifs: {
      ...(exercise.gifs.male ? { male: exercise.gifs.male } : {}),
      ...(exercise.gifs.female ? { female: exercise.gifs.female } : {}),
    },
  }));
}

async function fetchMetadataLists() {
  const [bodyParts, equipment, muscles] = await Promise.all([
    fetchJson(`${V1_BASE}/bodyparts`).catch(() => ({ data: [] })),
    fetchJson(`${V1_BASE}/equipments`).catch(() => ({ data: [] })),
    fetchJson(`${V1_BASE}/muscles`).catch(() => ({ data: [] })),
  ]);

  return {
    categories: (bodyParts.data ?? []).map((item) =>
      typeof item === "string" ? item : item.name
    ),
    equipment: (equipment.data ?? []).map((item) =>
      typeof item === "string" ? item : item.name
    ),
    muscles: (muscles.data ?? []).map((item) =>
      typeof item === "string" ? item : item.name
    ),
  };
}

const rapidApiKey = process.env.RAPIDAPI_KEY?.trim();

console.log("Fetching ExerciseDB V1 (free tier)…");
const v1Exercises = await fetchAllV1();

let allRaw = [...v1Exercises];

if (rapidApiKey) {
  console.log("Fetching ExerciseDB V2 (RapidAPI) for gender-specific media…");
  try {
    const v2Exercises = await fetchAllV2(rapidApiKey);
    allRaw = [...allRaw, ...v2Exercises];
    console.log(`Merged ${v2Exercises.length} V2 records`);
  } catch (error) {
    console.warn("V2 fetch failed — using V1 only:", error.message);
  }
} else {
  console.log("RAPIDAPI_KEY not set — using V1 GIFs for all genders");
}

const exercises = await validateAndRepairGifs(mergeExerciseRecords(allRaw));
const lists = await fetchMetadataLists();

const catalog = {
  source: "https://github.com/ExerciseDB/exercisedb-api",
  attribution:
    "Exercise data from ExerciseDB by AscendAPI (https://exercisedb.dev). Free tier: non-commercial use with attribution.",
  categories: lists.categories.length
    ? lists.categories
    : [...new Set(exercises.map((e) => e.category))].sort(),
  equipment: lists.equipment.length
    ? lists.equipment
    : [...new Set(exercises.flatMap((e) => e.equipment))].sort(),
  muscles: lists.muscles.length
    ? lists.muscles
    : [...new Set(exercises.flatMap((e) => e.primary_muscles))].sort(),
  muscle_groups: {},
  exercises: exercises.sort((a, b) => a.name.localeCompare(b.name)),
};

writeFileSync(OUT_PATH, JSON.stringify(catalog));
console.log(`Wrote ${catalog.exercises.length} exercises to ${OUT_PATH}`);
