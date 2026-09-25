export type PokPayEnv = "production" | "staging";

/**
 * Server-side PokPay environment.
 *
 * IMPORTANT: backend code must use `POKPAY_ENV` only (never `NEXT_PUBLIC_*`).
 */
export function getPokPayServerEnv(): PokPayEnv {
  const raw = (process.env.POKPAY_ENV ?? "").toLowerCase();
  return raw === "production" ? "production" : "staging";
}

/**
 * Client-side PokPay environment.
 *
 * IMPORTANT: client bundles can only read `NEXT_PUBLIC_*`.
 */
export function getPokPayClientEnv(): PokPayEnv {
  const raw = (process.env.NEXT_PUBLIC_POKPAY_ENV ?? "").toLowerCase();
  return raw === "production" ? "production" : "staging";
}

/** Shared secret embedded in PokPay webhook URLs when configured. */
export function getPokPayWebhookSecret(): string | null {
  const secret = process.env.POKPAY_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

/** Append webhook secret as a query param so PokPay POSTs include it. */
export function withPokPayWebhookSecret(webhookUrl: string): string {
  const secret = getPokPayWebhookSecret();
  if (!secret) return webhookUrl;
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set("secret", secret);
    return url.toString();
  } catch {
    const joiner = webhookUrl.includes("?") ? "&" : "?";
    return `${webhookUrl}${joiner}secret=${encodeURIComponent(secret)}`;
  }
}

export function verifyPokPayWebhookSecret(request: Request): boolean {
  const expected = getPokPayWebhookSecret();
  // When unset, skip auth (local/dev). Production should set POKPAY_WEBHOOK_SECRET.
  if (!expected) return true;

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader =
    request.headers.get("x-pokpay-webhook-secret") ??
    request.headers.get("x-webhook-secret");
  const auth = request.headers.get("authorization");
  const fromBearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  const provided = fromQuery ?? fromHeader ?? fromBearer;
  return typeof provided === "string" && provided === expected;
}

