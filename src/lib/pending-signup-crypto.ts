import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const VERSION = "v1";

function getKey(): Buffer {
  const secret =
    process.env.PENDING_SIGNUP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!secret) {
    throw new Error("Missing PENDING_SIGNUP_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a password for short-lived pending_signups rows. */
export function encryptPendingPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPendingPassword(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted password payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
