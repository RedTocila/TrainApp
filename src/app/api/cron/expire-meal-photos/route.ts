import { expireMealPhotos } from "@/lib/actions/meal-photos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await expireMealPhotos();
  return Response.json({ ok: true, ...result });
}
