import { readFileSync } from "fs";
import path from "path";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import { APPLE_BUNDLE_ID } from "@/lib/iap/products";

let rootCaBuffers: Buffer[] | null = null;
let sandboxVerifier: SignedDataVerifier | null = null;
let productionVerifier: SignedDataVerifier | null = null;

function loadAppleRootCAs(): Buffer[] {
  if (rootCaBuffers) return rootCaBuffers;
  const certPath = path.join(
    process.cwd(),
    "src/lib/iap/certs/AppleRootCA-G3.cer"
  );
  rootCaBuffers = [readFileSync(certPath)];
  return rootCaBuffers;
}

function getVerifier(environment: Environment): SignedDataVerifier {
  const roots = loadAppleRootCAs();
  const appAppleId = process.env.APPLE_APP_APPLE_ID
    ? Number(process.env.APPLE_APP_APPLE_ID)
    : undefined;

  if (environment === Environment.SANDBOX) {
    if (!sandboxVerifier) {
      sandboxVerifier = new SignedDataVerifier(
        roots,
        true,
        Environment.SANDBOX,
        APPLE_BUNDLE_ID,
        appAppleId
      );
    }
    return sandboxVerifier;
  }

  if (!productionVerifier) {
    if (!appAppleId || Number.isNaN(appAppleId)) {
      throw new Error(
        "APPLE_APP_APPLE_ID is required to verify production App Store transactions. Set it to your numeric App Store Connect app id."
      );
    }
    productionVerifier = new SignedDataVerifier(
      roots,
      true,
      Environment.PRODUCTION,
      APPLE_BUNDLE_ID,
      appAppleId
    );
  }
  return productionVerifier;
}

export type VerifiedAppleTransaction = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  environment: "Sandbox" | "Production";
  expiresDate: number | null;
  purchaseDate: number | null;
  appAccountToken: string | null;
  raw: JWSTransactionDecodedPayload;
};

function toVerified(
  payload: JWSTransactionDecodedPayload,
  environment: "Sandbox" | "Production"
): VerifiedAppleTransaction {
  if (!payload.transactionId || !payload.originalTransactionId || !payload.productId) {
    throw new Error("Apple transaction payload is missing required fields.");
  }
  if (payload.bundleId && payload.bundleId !== APPLE_BUNDLE_ID) {
    throw new Error(`Unexpected bundle id: ${payload.bundleId}`);
  }

  return {
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    productId: payload.productId,
    bundleId: payload.bundleId ?? APPLE_BUNDLE_ID,
    environment,
    expiresDate: payload.expiresDate ?? null,
    purchaseDate: payload.purchaseDate ?? null,
    appAccountToken: payload.appAccountToken ?? null,
    raw: payload,
  };
}

/**
 * Verify a StoreKit 2 signed transaction (JWS).
 * Production deployments only accept Production receipts (no Sandbox fallback).
 */
export async function verifyAppleTransactionJws(
  signedTransaction: string
): Promise<VerifiedAppleTransaction> {
  if (!signedTransaction || typeof signedTransaction !== "string") {
    throw new Error("Missing Apple signed transaction.");
  }

  const preferProduction = process.env.VERCEL_ENV === "production";
  const allowSandboxInProd = process.env.ALLOW_APPLE_SANDBOX === "true";
  const order: Environment[] =
    preferProduction && !allowSandboxInProd
      ? [Environment.PRODUCTION]
      : preferProduction
        ? [Environment.PRODUCTION, Environment.SANDBOX]
        : [Environment.SANDBOX, Environment.PRODUCTION];

  let lastError: unknown;
  for (const environment of order) {
    try {
      const verifier = getVerifier(environment);
      const payload = await verifier.verifyAndDecodeTransaction(signedTransaction);
      const verified = toVerified(
        payload,
        environment === Environment.PRODUCTION ? "Production" : "Sandbox"
      );

      if (
        verified.expiresDate != null &&
        verified.expiresDate > 0 &&
        verified.expiresDate < Date.now()
      ) {
        throw new Error("This Apple subscription has already expired.");
      }

      return verified;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not verify Apple transaction.");
}
