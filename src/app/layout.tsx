import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { StartupSplash, STARTUP_SPLASH_DISMISS_SCRIPT } from "@/components/startup-splash";
import { ThemeProvider } from "@/components/theme-provider";
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
html{background-color:#121214;color-scheme:dark}
html.light{background-color:#f4f4f5;color-scheme:light}
body{background-color:#121214;margin:0}
html.light body{background-color:#f4f4f5}
.startup-splash{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#121214;pointer-events:none;opacity:1;transition:opacity 280ms cubic-bezier(0.22,1,0.36,1)}
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
    "Your personalized workout, nutrition, and fitness coaching platform with AI coach and live sessions.",
  applicationName: PLATFORM_NAME,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Match boot canvas so the browser chrome never flashes white on first load.
  themeColor: "#121214",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLE }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');var isLight=t==='light';if(isLight){r.classList.add('light');r.classList.remove('dark');}else{r.classList.add('dark');r.classList.remove('light');}var p={red:{primary:'#dc2626',accent:'#ef4444',rgb:'220, 38, 38'},purple:{primary:'#9333ea',accent:'#a855f7',rgb:'147, 51, 234'},pink:{primary:'#db2777',accent:'#f472b6',rgb:'219, 39, 119'},teal:{primary:'#0d9488',accent:'#2dd4bf',rgb:'13, 148, 136'},blue:{primary:'#2563eb',accent:'#60a5fa',rgb:'37, 99, 235'},neon:{primary:'#16a34a',accent:'#4ade80',rgb:'34, 197, 94'},black:{primary:'#262626',accent:'#525252',rgb:'38, 38, 38',dark:{primary:'#e4e4e7',accent:'#fafafa',rgb:'228, 228, 231',primaryForeground:'#18181b'}},yellow:{primary:'#eab308',accent:'#facc15',rgb:'234, 179, 8'}};var a=localStorage.getItem('accent-color');if(a==='amber'){a='purple';localStorage.setItem('accent-color','purple');}var base=p[a]||p.red;var c=(!isLight&&base.dark)?base.dark:base;r.dataset.accent=a||'red';r.style.setProperty('--primary',c.primary);r.style.setProperty('--accent',c.accent);r.style.setProperty('--ring',c.primary);r.style.setProperty('--primary-rgb',c.rgb);if(c.primaryForeground)r.style.setProperty('--primary-foreground',c.primaryForeground);else r.style.removeProperty('--primary-foreground');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="premium-gradient min-h-screen antialiased">
        <StartupSplash />
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
        <script dangerouslySetInnerHTML={{ __html: STARTUP_SPLASH_DISMISS_SCRIPT }} />
      </body>
    </html>
  );
}
