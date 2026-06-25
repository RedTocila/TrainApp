export type PokPayEnv = "production" | "staging";

/**
 * Single source of truth for PokPay environment.
 *
 * - Server can read `POKPAY_ENV` (preferred) or fall back to `NEXT_PUBLIC_POKPAY_ENV`.
 * - Client bundles only have access to `NEXT_PUBLIC_POKPAY_ENV`.
 */
export function getPokPayEnv(): PokPayEnv {
  const raw =
    (process.env.NEXT_PUBLIC_POKPAY_ENV ?? process.env.POKPAY_ENV ?? "").toLowerCase();
  return raw === "production" ? "production" : "staging";
}

