import { searchWebQuery } from "@/lib/ai/web-search";
import { extractYoutubeId, isValidYoutubeUrl } from "@/lib/youtube";

function pickYoutubeUrl(urls: string[]): string | null {
  const shorts = urls.find((url) => /youtube\.com\/shorts\//i.test(url) && isValidYoutubeUrl(url));
  if (shorts) return shorts;

  const anyYoutube = urls.find((url) => isValidYoutubeUrl(url));
  return anyYoutube ?? null;
}

export async function findExerciseDemoVideo(exerciseName: string): Promise<string | null> {
  const name = exerciseName.trim();
  if (!name) return null;

  const sources = await searchWebQuery(
    `${name} exercise form how to youtube shorts site:youtube.com`
  );

  const urls = sources.map((source) => source.url);
  return pickYoutubeUrl(urls);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

export async function enrichExercisesWithDemoVideos<
  T extends { name: string; video_url?: string },
>(exercises: T[]): Promise<T[]> {
  return mapWithConcurrency(exercises, 4, async (exercise) => {
    if (exercise.video_url && isValidYoutubeUrl(exercise.video_url)) {
      return exercise;
    }

    const videoUrl = await findExerciseDemoVideo(exercise.name);
    return videoUrl ? { ...exercise, video_url: videoUrl } : exercise;
  });
}
