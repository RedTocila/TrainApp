import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { activateSubscriptionFromPokPayOrder } from "@/lib/actions/subscriptions";
import { verifyPokPayWebhookSecret } from "@/lib/pokpay/env";

export async function POST(request: Request) {
  if (!verifyPokPayWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId =
      body?.sdkOrderId ??
      body?.orderId ??
      body?.data?.sdkOrder?.id ??
      body?.data?.id;

    if (typeof orderId !== "string" || orderId.length === 0) {
      // Ack empty payloads so misconfigured probes don't retry forever.
      return NextResponse.json({ received: true });
    }

    await activateSubscriptionFromPokPayOrder(orderId);
    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("PokPay webhook error:", err);
    // Non-2xx so PokPay can retry activation after transient failures.
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
