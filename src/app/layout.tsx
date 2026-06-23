import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "TrainApp — Premium Personal Training",
  description: "Your personalized workout, nutrition, and fitness coaching platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');if(t==='light'){r.classList.add('light');r.classList.remove('dark');}else{r.classList.add('dark');r.classList.remove('light');}var p={red:{primary:'#dc2626',accent:'#ef4444',rgb:'220, 38, 38'},amber:{primary:'#d97706',accent:'#fbbf24',rgb:'217, 119, 6'},pink:{primary:'#db2777',accent:'#f472b6',rgb:'219, 39, 119'},teal:{primary:'#0d9488',accent:'#2dd4bf',rgb:'13, 148, 136'},blue:{primary:'#2563eb',accent:'#60a5fa',rgb:'37, 99, 235'},neon:{primary:'#16a34a',accent:'#4ade80',rgb:'34, 197, 94'}};var a=localStorage.getItem('accent-color');var c=p[a]||p.red;r.dataset.accent=a||'red';r.style.setProperty('--primary',c.primary);r.style.setProperty('--accent',c.accent);r.style.setProperty('--ring',c.primary);r.style.setProperty('--primary-rgb',c.rgb);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="premium-gradient min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
