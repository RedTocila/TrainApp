import {
  Bot,
  CalendarDays,
  Dumbbell,
  LineChart,
  Target,
  Video,
  type LucideIcon,
} from "lucide-react";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://trainapp.app";

export const CONTACT_EMAIL = "redtocila@gmail.com";

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface LandingUpdate {
  date: string;
  tag: string;
  title: string;
  description: string;
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Dumbbell,
    title: "Programs",
    description:
      "Workout and nutrition in one place — build sessions, log meals, and track macros from a unified dashboard.",
  },
  {
    icon: Bot,
    title: "AI Coach",
    description:
      "Photo and text meal logging, smart suggestions, progress predictions, weekly reports, and habit insights.",
  },
  {
    icon: Video,
    title: "Live coaching",
    description:
      "Join live sessions with your coach, follow structured classes, and replay anytime on the AI plan.",
  },
  {
    icon: CalendarDays,
    title: "Daily dashboard",
    description:
      "Calendar strip, to-dos, water, habits, cardio, and weight — everything rolls forward at midnight.",
  },
  {
    icon: Target,
    title: "Custom trainer plans",
    description:
      "Order a bespoke workout (€49) or nutrition plan (€79) from RedTocila — implement straight onto your calendar.",
  },
  {
    icon: LineChart,
    title: "Progress tracking",
    description:
      "Weight trends, macro bars, session history, and AI-powered recommendations that adapt to your data.",
  },
];

export const LANDING_UPDATES: LandingUpdate[] = [
  {
    date: "Jun 2025",
    tag: "New",
    title: "Live coaching",
    description:
      "Browse live sessions and replays. Renamed from Classes — same great coaching, clearer name.",
  },
  {
    date: "Jun 2025",
    tag: "AI",
    title: "AI meal suggestions & reports",
    description:
      "Get meal ideas from your macros, weekly AI reports, and progress predictions on LevelUp AI.",
  },
  {
    date: "Jun 2025",
    tag: "Plans",
    title: "Custom plan delivery",
    description:
      "Coach-built workout and nutrition plans arrive in-app. Tap Implement to add them to your calendar instantly.",
  },
  {
    date: "Jun 2025",
    tag: "UX",
    title: "Programs hub",
    description:
      "Workout and nutrition merged under Programs with quick tabs — less navigation, more training.",
  },
];

export const LANDING_STATS = [
  { value: "2", label: "Subscription tiers" },
  { value: "€7", label: "Core from /mo" },
  { value: "€49", label: "Custom workout" },
  { value: "24/7", label: "Track anytime" },
];

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#updates", label: "What's new" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;
