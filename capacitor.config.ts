import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell loads the live Next.js site (SSR + server actions stay on Vercel).
 * Local fallback HTML lives in native-shell/www for offline boot / first paint.
 */
const config: CapacitorConfig = {
  appId: "al.rutina.app",
  appName: "RUTINA",
  webDir: "native-shell/www",
  // Lets the server recognise app requests (see src/lib/native-app-request.ts).
  appendUserAgent: "RutinaApp",
  server: {
    // Production web app — change via CAP_SERVER_URL for staging/dev builds.
    // Logged-in cold start. Logged-out native requests are sent to /ios/welcome
    // by the proxy, so launch is one document instead of a redirect from /.
    url: process.env.CAP_SERVER_URL ?? "https://rutina.al/dashboard",
    cleartext: false,
    allowNavigation: [
      "rutina.al",
      "www.rutina.al",
      "*.supabase.co",
      "*.pok.al",
      "*.pokpay.io",
      "*.nebula.ltd",
    ],
  },
  plugins: {
    SplashScreen: {
      // Stay up until the page boot script calls SplashScreen.hide().
      // 12s is only the fallback if that script never runs.
      launchAutoHide: true,
      launchShowDuration: 12000,
      launchFadeOutDuration: 200,
      backgroundColor: "#f80213",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0c0c0e",
    },
    Camera: {
      permissions: ["camera", "photos"],
    },
    LocalNotifications: {
      iconColor: "#dc2626",
      sound: "default",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    backgroundColor: "#0c0c0e",
    // CSS pads for the notch/home indicator via env(safe-area-inset-*); a native inset would double it.
    contentInset: "never",
    preferredContentMode: "mobile",
    scheme: "RUTINA",
    // Must stay false unless Info.plist lists every host in WKAppBoundDomains (max 10).
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0c0c0e",
  },
};

export default config;
