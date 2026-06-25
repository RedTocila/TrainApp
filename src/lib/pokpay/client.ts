import { getPokPayEnv } from "@/lib/pokpay/env";

const POKPAY_BASE_URL =
  getPokPayEnv() === "production" ? "https://api.pokpay.io" : "https://api-staging.pokpay.io";

function requirePokPayConfig() {
  const keyId = process.env.POKPAY_KEY_ID;
  const keySecret = process.env.POKPAY_KEY_SECRET;
  const merchantId = process.env.POKPAY_MERCHANT_ID;
  if (!keyId || !keySecret || !merchantId) {
    throw new Error(
      "PokPay is not configured. Set POKPAY_KEY_ID, POKPAY_KEY_SECRET, and POKPAY_MERCHANT_ID."
    );
  }
  return { keyId, keySecret, merchantId };
}

interface PokPayEnvelope<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  errors?: unknown[];
}

export interface PokPaySdkOrder {
  id: string;
  amount: number;
  capturedAmount?: number;
  currencyCode: string;
  status?: string;
}

async function pokPayFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${POKPAY_BASE_URL}${path}`, init);
  const json = (await res.json()) as PokPayEnvelope<T>;
  if (!res.ok) {
    throw new Error(json.message ?? `PokPay request failed (${res.status})`);
  }
  if (!json.data) {
    throw new Error(json.message ?? "PokPay returned an empty response");
  }
  return json.data;
}

export async function pokpayLogin(): Promise<string> {
  const { keyId, keySecret } = requirePokPayConfig();
  const data = await pokPayFetch<{ accessToken: string }>("/auth/sdk/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyId, keySecret }),
  });
  return data.accessToken;
}

export async function createSdkOrder(params: {
  amountCents: number;
  currencyCode?: string;
  redirectUrl: string;
  webhookUrl?: string;
}): Promise<PokPaySdkOrder> {
  const { merchantId } = requirePokPayConfig();
  const accessToken = await pokpayLogin();
  const data = await pokPayFetch<{ sdkOrder: PokPaySdkOrder }>(
    `/merchants/${merchantId}/sdk-orders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        amount: params.amountCents,
        currencyCode: params.currencyCode ?? "EUR",
        autoCapture: true,
        shippingCost: 0,
        redirectUrl: params.redirectUrl,
        webhookUrl: params.webhookUrl,
      }),
    }
  );
  return data.sdkOrder;
}

export async function getSdkOrder(orderId: string): Promise<PokPaySdkOrder> {
  const accessToken = await pokpayLogin();
  const data = await pokPayFetch<{ sdkOrder?: PokPaySdkOrder } & PokPaySdkOrder>(
    `/sdk-orders/${orderId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return (data.sdkOrder ?? data) as PokPaySdkOrder;
}

export function isSdkOrderPaid(order: PokPaySdkOrder): boolean {
  if (order.capturedAmount != null && order.capturedAmount >= order.amount) {
    return true;
  }
  const status = order.status?.toLowerCase() ?? "";
  return (
    status.includes("capture") ||
    status.includes("paid") ||
    status.includes("complete") ||
    status.includes("success")
  );
}

export function pokpayPublicEnv(): "production" | "staging" {
  return getPokPayEnv();
}
