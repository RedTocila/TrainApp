import { WEBSITE_SIGNUP_URL } from "@/lib/website-signup";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";

export function websiteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_SITE_ORIGIN}${normalized}`;
}

/** Leave the Capacitor webview and open an account or billing page in the system browser. */
export async function openWebsitePath(path: string): Promise<void> {
  const url = websiteUrl(path);
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    return;
  }
  window.location.assign(url);
}

/** Leave the Capacitor webview and open the website signup funnel in the system browser. */
export async function openWebsiteSignup(): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: WEBSITE_SIGNUP_URL });
      return;
    }
  } catch {
    // Stay on the welcome screen if the system browser cannot open.
    return;
  }
  window.location.assign(WEBSITE_SIGNUP_URL);
}
