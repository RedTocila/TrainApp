import { NextResponse } from "next/server";
import { getCachedAllPerEur } from "@/lib/exchange-rates";

export async function GET() {
  const allPerEur = await getCachedAllPerEur();
  return NextResponse.json(
    { allPerEur },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
