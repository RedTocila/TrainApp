import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { StartupSplash } from "@/components/startup-splash";
import { HtmlBootScript } from "@/components/html-boot-script";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { NativeAppBootstrap } from "@/components/native-app-bootstrap";
import { NativeRouteGuard } from "@/components/ios/native-route-guard";
import { PwaRegister } from "@/components/pwa-register";
import { getRequestLocale } from "@/lib/guest-locale-server";
import { getHtmlLang } from "@/lib/platform-copy";
import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/brand";
import "@nebula-ltd/pok-payments-js/lib/index.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Critical boot CSS: dark canvas + splash before stylesheet/JS bundles load. */
const BOOT_STYLE = `
html{background-color:#0c0c0e;color-scheme:dark}
body{background-color:#0c0c0e;margin:0}
.startup-splash{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#f80213;pointer-events:none;opacity:1;transition:opacity 280ms cubic-bezier(0.22,1,0.36,1)}
.startup-splash--hide{opacity:0}
.startup-splash__mark{display:flex;align-items:center;justify-content:center}
.startup-splash__logo{width:min(46vw,12.5rem);height:auto;display:block}
@media (prefers-reduced-motion:reduce){.startup-splash{transition:none}}
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`,
    template: `%s | ${PLATFORM_NAME}`,
  },
  description:
    "Platforma jote e personalizuar për stërvitje, ushqim dhe coaching — me coach AI dhe sesione live.",
  applicationName: PLATFORM_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: PLATFORM_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={getHtmlLang(locale)}
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLE }} />
      </head>
      <body className="premium-gradient min-h-screen antialiased">
        <HtmlBootScript />
        <StartupSplash />
        <ThemeProvider>
          <LocaleProvider locale={locale} syncGuestStorage>
            {children}
            <NativeAppBootstrap />
            <NativeRouteGuard />
            <PwaRegister />
          </LocaleProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
