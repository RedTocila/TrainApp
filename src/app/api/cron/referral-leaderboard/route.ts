import { NextResponse } from "next/server";
import { processMonthlyLeaderboardRewards } from "@/lib/referral-leaderboard-rewards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processMonthlyLeaderboardRewards();
  return NextResponse.json({ ok: true, ...result });
}
