import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { activateSubscriptionFromPokPayOrder } from "@/lib/actions/subscriptions";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId =
      body?.sdkOrderId ??
      body?.orderId ??
      body?.data?.sdkOrder?.id ??
      body?.data?.id;

    if (typeof orderId === "string" && orderId.length > 0) {
      await activateSubscriptionFromPokPayOrder(orderId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("PokPay webhook error:", err);
    return NextResponse.json({ received: true });
  }
}
