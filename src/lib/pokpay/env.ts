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

