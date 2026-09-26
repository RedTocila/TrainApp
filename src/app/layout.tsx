import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { StartupSplash } from "@/components/startup-splash";
import { HtmlBootScript } from "@/components/html-boot-script";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { NativeAppBootstrap } from "@/components/native-app-bootstrap";
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
.startup-splash{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#0c0c0e;pointer-events:none;opacity:1;transition:opacity 280ms cubic-bezier(0.22,1,0.36,1)}
.startup-splash--hide{opacity:0}
.startup-splash__mark{display:flex;flex-direction:column;align-items:center;gap:1.25rem}
.startup-splash__word{font-family:var(--font-geist-sans),ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:clamp(1.75rem,5vw,2.25rem);font-weight:900;letter-spacing:-0.03em;line-height:1;text-transform:uppercase;color:#fafafa}
.startup-splash__accent{color:#dc2626}
.startup-splash__loader{display:block;width:2.5rem;height:2px;border-radius:1px;background:rgba(255,255,255,0.12);overflow:hidden;position:relative}
.startup-splash__loader::after{content:"";position:absolute;inset:0;width:40%;border-radius:inherit;background:#dc2626;animation:startup-splash-loader 1.1s cubic-bezier(0.45,0,0.15,1) infinite}
@keyframes startup-splash-loader{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
@media (prefers-reduced-motion:reduce){.startup-splash{transition:none}.startup-splash__loader::after{animation:none;width:100%;opacity:0.55}}
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
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
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
            <PwaRegister />
          </LocaleProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
