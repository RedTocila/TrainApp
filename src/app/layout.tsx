import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/brand";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`,
    template: `%s | ${PLATFORM_NAME}`,
  },
  description:
    "Your personalized workout, nutrition, and fitness coaching platform with AI coach and live sessions.",
  applicationName: PLATFORM_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');var isLight=t==='light';if(isLight){r.classList.add('light');r.classList.remove('dark');}else{r.classList.add('dark');r.classList.remove('light');}var p={red:{primary:'#dc2626',accent:'#ef4444',rgb:'220, 38, 38'},amber:{primary:'#d97706',accent:'#fbbf24',rgb:'217, 119, 6'},pink:{primary:'#db2777',accent:'#f472b6',rgb:'219, 39, 119'},teal:{primary:'#0d9488',accent:'#2dd4bf',rgb:'13, 148, 136'},blue:{primary:'#2563eb',accent:'#60a5fa',rgb:'37, 99, 235'},neon:{primary:'#16a34a',accent:'#4ade80',rgb:'34, 197, 94'},black:{primary:'#262626',accent:'#525252',rgb:'38, 38, 38',dark:{primary:'#e4e4e7',accent:'#fafafa',rgb:'228, 228, 231',primaryForeground:'#18181b'}},yellow:{primary:'#eab308',accent:'#facc15',rgb:'234, 179, 8'}};var a=localStorage.getItem('accent-color');var base=p[a]||p.red;var c=(!isLight&&base.dark)?base.dark:base;r.dataset.accent=a||'red';r.style.setProperty('--primary',c.primary);r.style.setProperty('--accent',c.accent);r.style.setProperty('--ring',c.primary);r.style.setProperty('--primary-rgb',c.rgb);if(c.primaryForeground)r.style.setProperty('--primary-foreground',c.primaryForeground);else r.style.removeProperty('--primary-foreground');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="premium-gradient min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
