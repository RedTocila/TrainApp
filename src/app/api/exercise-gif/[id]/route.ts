import { NextRequest, NextResponse } from "next/server";
import { pickExerciseDbGifUrl } from "@/lib/exercise-gif-proxy";

const RAPIDAPI_HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

function rapidApiHeaders(apiKey: string): HeadersInit {
  return {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
  };
}

async function fetchExerciseGifFromRapidApi(
  id: string,
  apiKey: string
): Promise<Response | null> {
  const exerciseRes = await fetch(
    `https://${RAPIDAPI_HOST}/api/v1/exercises/${encodeURIComponent(id)}`,
    { headers: rapidApiHeaders(apiKey), next: { revalidate: 86400 } }
  );

  if (!exerciseRes.ok) return null;

  const json = (await exerciseRes.json()) as {
    data?: { gifUrl?: string; gifUrls?: Record<string, string> };
    gifUrl?: string;
    gifUrls?: Record<string, string>;
  };

  const exercise = json.data ?? json;
  const gifUrl = pickExerciseDbGifUrl(exercise);
  if (!gifUrl) return null;

  const gifRes = await fetch(gifUrl, {
    headers: rapidApiHeaders(apiKey),
    next: { revalidate: 86400 },
  });

  return gifRes.ok ? gifRes : null;
}

async function fetchStaticExerciseGif(id: string): Promise<Response | null> {
  const gifRes = await fetch(
    `https://static.exercisedb.dev/media/${encodeURIComponent(id)}.gif`,
    { next: { revalidate: 86400 } }
  );

  return gifRes.ok ? gifRes : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const exerciseId = id?.trim();

  if (!exerciseId || !/^[a-zA-Z0-9]+$/.test(exerciseId)) {
    return NextResponse.json({ error: "Invalid exercise id" }, { status: 400 });
  }

  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  const gifRes =
    (apiKey ? await fetchExerciseGifFromRapidApi(exerciseId, apiKey) : null) ??
    (await fetchStaticExerciseGif(exerciseId));

  if (!gifRes) {
    return NextResponse.json({ error: "GIF not found" }, { status: 404 });
  }

  const bytes = await gifRes.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": gifRes.headers.get("content-type") ?? "image/gif",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
