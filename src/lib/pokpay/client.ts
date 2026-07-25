import { getPokPayServerEnv } from "@/lib/pokpay/env";
import { toPokPayAmount } from "@/lib/checkout-i18n";

const POKPAY_BASE_URL =
  getPokPayServerEnv() === "production"
    ? "https://api.pokpay.io"
    : "https://api-staging.pokpay.io";

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
  serverStatusCode?: number;
  requestId?: string;
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

export interface PokPaySdkOrderProduct {
  name: string;
  quantity: number;
  /** Line price in app minor units; converted for PokPay in createSdkOrder. */
  price: number;
}

export class PokPayHttpError extends Error {
  name = "PokPayHttpError";
  status: number;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseHeaders: Record<string, string>;
  responseBodyText?: string;
  responseJson?: unknown;

  constructor(args: {
    message: string;
    status: number;
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    responseHeaders: Record<string, string>;
    responseBodyText?: string;
    responseJson?: unknown;
    cause?: unknown;
  }) {
    super(args.message);
    this.status = args.status;
    this.url = args.url;
    this.method = args.method;
    this.requestHeaders = args.requestHeaders;
    this.requestBody = args.requestBody;
    this.responseHeaders = args.responseHeaders;
    this.responseBodyText = args.responseBodyText;
    this.responseJson = args.responseJson;
    if (args.cause !== undefined) {
      this.cause = args.cause;
    }
  }
}

function sanitizeHeaders(h?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const entries =
    h instanceof Headers
      ? Array.from(h.entries())
      : Array.isArray(h)
        ? h
        : Object.entries(h);
  for (const [k, v] of entries) {
    const key = k.toLowerCase();
    if (key === "authorization") out[k] = "[REDACTED]";
    else out[k] = String(v);
  }
  return out;
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of h.entries()) out[k] = v;
  return out;
}

async function pokPayFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${POKPAY_BASE_URL}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  const requestHeaders = sanitizeHeaders(init?.headers);
  const requestBody = typeof init?.body === "string" ? init.body : undefined;

  console.info("[pokpay] request", { url, method, headers: requestHeaders, body: requestBody });

  try {
    const res = await fetch(url, init);
    const responseBodyText = await res.text();

    let responseJson: unknown;
    try {
      responseJson = responseBodyText ? JSON.parse(responseBodyText) : undefined;
    } catch {
      responseJson = undefined;
    }

    console.info("[pokpay] response", {
      url,
      method,
      status: res.status,
      headers: headersToObject(res.headers),
      bodyText: responseBodyText,
      json: responseJson,
    });

    if (!res.ok) {
      const msg =
        (responseJson as any)?.message ?? `PokPay request failed (${res.status})`;
      throw new PokPayHttpError({
        message: msg,
        status: res.status,
        url,
        method,
        requestHeaders,
        requestBody,
        responseHeaders: headersToObject(res.headers),
        responseBodyText,
        responseJson,
      });
    }

    const envelope = responseJson as PokPayEnvelope<T> | undefined;
    if (!envelope?.data) {
      throw new PokPayHttpError({
        message: envelope?.message ?? "PokPay returned an empty response",
        status: res.status,
        url,
        method,
        requestHeaders,
        requestBody,
        responseHeaders: headersToObject(res.headers),
        responseBodyText,
        responseJson,
      });
    }

    return envelope.data;
  } catch (err) {
    console.error("[pokpay] exception", err);
    throw err;
  }
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
  /** Amount in app minor units (cents); converted for PokPay before send. */
  amountCents: number;
  currencyCode?: string;
  redirectUrl: string;
  webhookUrl?: string;
  failRedirectUrl?: string;
  description?: string;
  merchantCustomReference?: string;
  products: PokPaySdkOrderProduct[];
}): Promise<PokPaySdkOrder> {
  const { merchantId } = requirePokPayConfig();
  const accessToken = await pokpayLogin();
  const amount = toPokPayAmount(params.amountCents);
  const products = params.products.map((product) => ({
    ...product,
    price: toPokPayAmount(product.price),
  }));
  const data = await pokPayFetch<{ sdkOrder: PokPaySdkOrder }>(
    `/merchants/${merchantId}/sdk-orders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        amount,
        currencyCode: params.currencyCode ?? "EUR",
        autoCapture: true,
        products,
        shippingCost: 0,
        redirectUrl: params.redirectUrl,
        failRedirectUrl: params.failRedirectUrl,
        webhookUrl: params.webhookUrl,
        merchantCustomReference: params.merchantCustomReference,
        description: params.description,
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

export type PokPayAddCardPayload = {
  csFlexCard: {
    jwe: string;
    expirationYear?: string;
    expirationMonth?: string;
  };
  billingInfo: {
    firstName: string;
    lastName: string;
    email: string;
    countryCode: string;
    administrativeArea: string;
    locality: string;
    address1: string;
    postalCode: string;
    phoneNumber: string;
  };
  securityCode: string;
};

export type PokPayTokenizedCard = {
  id: string;
  last4?: string | null;
  brand?: string | null;
};

/** Exchange AddCardForm / encryptCard payload for a permanent vaulted card id. */
export async function tokenizeGuestCard(
  payload: PokPayAddCardPayload
): Promise<PokPayTokenizedCard> {
  const accessToken = await pokpayLogin();
  const data = await pokPayFetch<
    | PokPayTokenizedCard
    | { creditDebitCard?: PokPayTokenizedCard; card?: PokPayTokenizedCard; cardId?: string }
  >("/credit-debit-cards/tokenize-guest-card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      csFlexCard: payload.csFlexCard,
      billingInfo: {
        ...payload.billingInfo,
        sameAsShipping: true,
      },
      securityCode: payload.securityCode,
    }),
  });

  const card =
    (data as { creditDebitCard?: PokPayTokenizedCard }).creditDebitCard ??
    (data as { card?: PokPayTokenizedCard }).card ??
    (typeof (data as { cardId?: string }).cardId === "string"
      ? { id: (data as { cardId: string }).cardId }
      : null) ??
    (typeof (data as PokPayTokenizedCard).id === "string"
      ? (data as PokPayTokenizedCard)
      : null);

  if (!card?.id) {
    throw new Error("PokPay tokenize did not return a card id.");
  }
  return card;
}

export async function setupTokenized3ds(params: {
  cardId: string;
  sdkOrderId: string;
}): Promise<{ payerAuthentication?: unknown }> {
  const accessToken = await pokpayLogin();
  return pokPayFetch<{ payerAuthentication?: unknown }>(
    `/credit-debit-cards/${params.cardId}/setup-tokenized-3ds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sdkOrder: { id: params.sdkOrderId },
      }),
    }
  );
}

/** Charge a previously vaulted card against an SDK order (server-side). */
export async function guestConfirmSdkOrder(params: {
  sdkOrderId: string;
  cardId: string;
  consumerAuthenticationInformation?: unknown;
}): Promise<unknown> {
  const accessToken = await pokpayLogin();
  const body: Record<string, unknown> = {
    creditCardId: params.cardId,
  };
  if (params.consumerAuthenticationInformation != null) {
    body.consumerAuthenticationInformation = params.consumerAuthenticationInformation;
  }

  return pokPayFetch(`/sdk-orders/${params.sdkOrderId}/guest-confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
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
  return getPokPayServerEnv();
}
