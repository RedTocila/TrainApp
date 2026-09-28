/** Set by the Capacitor shell on first load so the server can tell app requests apart. */
export const NATIVE_APP_COOKIE = "rutina_native";

/** Appended to the WebView user agent via `appendUserAgent` in capacitor.config.ts. */
export const NATIVE_APP_USER_AGENT_TOKEN = "RutinaApp";

export function isNativeAppRequest(
  cookieValue: string | undefined,
  userAgent: string | null
): boolean {
  return cookieValue === "1" || Boolean(userAgent?.includes(NATIVE_APP_USER_AGENT_TOKEN));
}
