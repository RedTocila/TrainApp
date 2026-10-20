import { WEBSITE_SIGNUP_URL } from "@/lib/website-signup";

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
