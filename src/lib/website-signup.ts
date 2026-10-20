import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";

/** Website funnel: questionnaire, account, then payment. */
export const WEBSITE_SIGNUP_URL = `${CANONICAL_SITE_ORIGIN}/get-started`;

/** Custom scheme the native shell already accepts in NativeAppBootstrap. */
export function appLoginUrl(email?: string | null): string {
  const params = new URLSearchParams();
  const trimmed = email?.trim();
  if (trimmed) params.set("email", trimmed);
  const query = params.toString();
  return `rutina://login${query ? `?${query}` : ""}`;
}
