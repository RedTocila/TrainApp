import {
  findCatalogExercise,
  getCatalogGifUrl,
  getCatalogGifUrls,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import { toExerciseGifProxyUrl } from "@/lib/exercise-gif-proxy";

export type ExerciseGender = "male" | "female";

export function resolveProfileGender(
  gender?: string | null
): ExerciseGender | undefined {
  if (gender === "male" || gender === "female") return gender;
  return undefined;
}

export function isGifUrl(url: string): boolean {
  return /\.gif($|\?)/i.test(url) || url.includes("static.exercisedb.dev");
}

export function resolveExerciseGifUrl({
  name,
  imageUrl,
  gender,
}: {
  name: string;
  imageUrl?: string | null;
  gender?: ExerciseGender | null;
}): string | null {
  if (imageUrl?.trim()) {
    return toExerciseGifProxyUrl(imageUrl.trim()) ?? imageUrl.trim();
  }

  const catalog = findCatalogExercise(name);
  if (!catalog) return null;

  return getCatalogGifUrl(catalog, gender);
}

export function resolveExerciseGifUrls({
  name,
  imageUrl,
  gender,
}: {
  name: string;
  imageUrl?: string | null;
  gender?: ExerciseGender | null;
}): { url: string | null; fallbackUrl: string | null } {
  const catalog = findCatalogExercise(name);
  const catalogGifs = catalog ? getCatalogGifUrls(catalog, gender) : { url: null, fallbackUrl: null };

  const stored = imageUrl?.trim() || null;
  if (stored) {
    const proxiedStored = toExerciseGifProxyUrl(stored) ?? stored;
    return {
      url: proxiedStored,
      fallbackUrl:
        catalogGifs.url && catalogGifs.url !== proxiedStored
          ? catalogGifs.url
          : catalogGifs.fallbackUrl,
    };
  }

  return catalogGifs;
}

export function enrichExerciseWithGif<
  T extends { name: string; image_url?: string | null },
>(exercise: T, gender?: ExerciseGender | null): T {
  if (exercise.image_url?.trim()) return exercise;

  const gifUrl = resolveExerciseGifUrl({
    name: exercise.name,
    gender,
  });
  if (!gifUrl) return exercise;

  return { ...exercise, image_url: gifUrl };
}

export function enrichExercisesWithGifs<
  T extends { name: string; image_url?: string | null },
>(exercises: T[], gender?: ExerciseGender | null): T[] {
  return exercises.map((exercise) => enrichExerciseWithGif(exercise, gender));
}

export function getCatalogDemoForExercise(
  name: string,
  gender?: ExerciseGender | null
): { gifUrl: string | null; catalog: CatalogExercise | null } {
  const catalog = findCatalogExercise(name);
  if (!catalog) return { gifUrl: null, catalog: null };
  return { gifUrl: getCatalogGifUrl(catalog, gender), catalog };
}
