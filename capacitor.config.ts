import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell loads the live Next.js site (SSR + server actions stay on Vercel).
 * Local fallback HTML lives in native-shell/www for offline boot / first paint.
 */
const config: CapacitorConfig = {
  appId: "al.rutina.app",
  appName: "RUTINA",
  webDir: "native-shell/www",
  server: {
    // Production web app — change via CAP_SERVER_URL for staging/dev builds.
    url: process.env.CAP_SERVER_URL ?? "https://rutina.al",
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
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: "#121214",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#121214",
    },
    Camera: {
      permissions: ["camera", "photos"],
    },
    LocalNotifications: {
      iconColor: "#dc2626",
      sound: "default",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "RUTINA",
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#121214",
  },
};

export default config;
