"use server";

/** Kept for older app builds. Accounts and billing are created on the website. */
export async function ensureAppFreeAccess(): Promise<{ granted: boolean }> {
  return { granted: false };
}
