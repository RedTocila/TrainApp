import {
  Bot,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LineChart,
  Package,
  Target,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://trainapp.app";

export const CONTACT_EMAIL = "redtocila@gmail.com";

/** Primary funnel CTA — questionnaire → sign up → packages */
export const GET_STARTED_CTA = "Get Your Custom Program";
export const GET_STARTED_HREF = "/get-started";

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  tagline: string;
  accent: string;
}

export interface FunnelStep {
  step: number;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export const FUNNEL_STEPS: FunnelStep[] = [
  {
    step: 1,
    icon: ClipboardList,
    title: "Quick questionnaire",
    subtitle: "Body, goals & lifestyle",
  },
  {
    step: 2,
    icon: UserPlus,
    title: "Create account",
    subtitle: "Your plan is saved",
  },
  {
    step: 3,
    icon: Package,
    title: "Pick a package",
    subtitle: "Skip anytime",
  },
];

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Dumbbell,
    title: "Programs",
    tagline: "Workouts + meals in one hub",
    accent: "from-orange-500/20 to-orange-500/5",
  },
  {
    icon: Bot,
    title: "AI Coach",
    tagline: "Log meals, get insights",
    accent: "from-violet-500/20 to-violet-500/5",
  },
  {
    icon: Video,
    title: "Live coaching",
    tagline: "Join sessions & replays",
    accent: "from-sky-500/20 to-sky-500/5",
  },
  {
    icon: CalendarDays,
    title: "Daily dashboard",
    tagline: "Calendar, habits & water",
    accent: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    icon: Target,
    title: "Custom plans",
    tagline: "Coach-built, calendar-ready",
    accent: "from-rose-500/20 to-rose-500/5",
  },
  {
    icon: LineChart,
    title: "Progress",
    tagline: "Weight, macros & trends",
    accent: "from-amber-500/20 to-amber-500/5",
  },
];

export const LANDING_HIGHLIGHTS = [
  { icon: Bot, label: "AI meal logging" },
  { icon: LineChart, label: "Macro tracking" },
  { icon: Video, label: "Live sessions" },
  { icon: Target, label: "Custom plans" },
] as const;

export const LANDING_STATS = [
  { value: "2 min", label: "Setup time" },
  { value: "€7", label: "Core from /mo" },
  { value: "AI", label: "Smart coaching" },
  { value: "24/7", label: "Track anytime" },
];

export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;
