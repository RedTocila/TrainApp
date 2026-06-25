import {
  Bot,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Flame,
  LineChart,
  MessageCircle,
  Package,
  Target,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";

import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  CANONICAL_SITE_ORIGIN;

export const CONTACT_EMAIL = "redtocila@gmail.com";

/** Coach support line — shown in-app for call/text. */
export const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+355699944675";

export const SUPPORT_PHONE_DISPLAY =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY ?? "+355 69 994 4675";

/** Primary funnel CTA — questionnaire → sign up → packages */
export const GET_STARTED_CTA = "Get Your Custom Program";
export const GET_STARTED_HREF = "/get-started";

export const LANDING_HERO_IMAGE = "/landing/hero.png";

export interface AppPreviewHighlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const LANDING_APP_PREVIEW_HIGHLIGHTS: AppPreviewHighlight[] = [
  {
    icon: Target,
    title: "Personalized plans",
    description: "Programs that adapt to your goals, level, and progress.",
  },
  {
    icon: Dumbbell,
    title: "Smart workouts",
    description: "Guided sessions with sets, reps, rest timers, and video demos.",
  },
  {
    icon: LineChart,
    title: "Track & improve",
    description: "Weight, macros, and trends — see what's working over time.",
  },
  {
    icon: CalendarDays,
    title: "Stay consistent",
    description: "Calendar, habits, and reminders that keep you showing up.",
  },
];

export const LANDING_APP_STATS = [
  { value: "10,000+", label: "Active users" },
  { value: "50,000+", label: "Workouts completed" },
  { value: "3.2M+", label: "Kg lifted" },
  { value: "95%", label: "User satisfaction" },
] as const;

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

export interface CoachAlexHighlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const COACH_ALEX_HIGHLIGHTS: CoachAlexHighlight[] = [
  {
    icon: Target,
    title: "Helps you stay on track",
    description:
      "Meal logs, workouts, and habits — Alex keeps you accountable without the boring lecture.",
  },
  {
    icon: Flame,
    title: "Motivates you to push harder",
    description:
      "Real talk that fires you up. No fluff, no empty cheerleading — just the nudge you need.",
  },
  {
    icon: MessageCircle,
    title: "Designed to make you win",
    description:
      "Built around your goals with insights that turn data into action, not guilt.",
  },
  {
    icon: Bot,
    title: "Always in your corner",
    description:
      "Snap a meal, ask a question, or get roasted for skipping leg day — 24/7 in your pocket.",
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

export interface LandingReview {
  name: string;
  context: string;
  quote: string;
  rating: number;
}

export const LANDING_REVIEWS: LandingReview[] = [
  {
    name: "Ardit K.",
    context: "Fat loss · 4 months",
    quote:
      "Photo meal logging changed everything. I finally know my macros instead of guessing every plate.",
    rating: 5,
  },
  {
    name: "Elona M.",
    context: "Busy professional",
    quote:
      "The daily dashboard keeps me honest — workouts, water, habits, all in one place. No more scattered notes.",
    rating: 5,
  },
  {
    name: "Marko D.",
    context: "Strength training",
    quote:
      "Coach Alex doesn't sugarcoat it. That push is exactly what I needed to stop skipping sessions.",
    rating: 5,
  },
  {
    name: "Sara L.",
    context: "Custom nutrition plan",
    quote:
      "Got a coach-built meal plan dropped straight into my calendar. Finally eating for my goal, not vibes.",
    rating: 5,
  },
  {
    name: "Besnik H.",
    context: "Live coaching member",
    quote:
      "Live sessions plus replays mean I never miss a workout even when travel wrecks my schedule.",
    rating: 5,
  },
  {
    name: "Drita A.",
    context: "First-time lifter",
    quote:
      "Signed up in minutes, picked a plan, and had structure from day one. Way less overwhelming than going solo.",
    rating: 5,
  },
];

export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;
