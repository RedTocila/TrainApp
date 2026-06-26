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
export const LANDING_HERO_BACKGROUND_IMAGE = "/landing/hero-background.png";
export const LANDING_BACKGROUND_IMAGE = "/landing/landing-background.png";
export const LANDING_BACKGROUND_IMAGE_LIGHT = "/landing/landing-background-light.png";

/** Override with NEXT_PUBLIC_LANDING_HERO_YOUTUBE_URL if needed */
export const LANDING_HERO_YOUTUBE_URL =
  process.env.NEXT_PUBLIC_LANDING_HERO_YOUTUBE_URL ??
  "https://www.youtube.com/watch?v=RJXjyS7jnlU&t=21s";
export const LANDING_MEAL_PHOTO_LOG_IMAGE = "/landing/meal-photo-log-flow.png";
export const LANDING_TRACK_PROGRESS_IMAGE = "/landing/track-progress-v2.png";
export const LANDING_AI_PREDICTIONS_IMAGE = "/landing/ai-predictions-v2.png";

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

export const LANDING_FOUNDER_IMAGE = "/landing/transformations/transformation-10.png";

export interface LandingFounderBio {
  name: string;
  role: string;
  headline: string;
  paragraphs: string[];
  kgLost: number;
  months: number;
  imageAlt: string;
}

export const LANDING_FOUNDER_BIO: LandingFounderBio = {
  name: "Redjan Tocila",
  role: "Founder & coach",
  headline: "I built RUTINA because I needed it myself.",
  paragraphs: [
    "I'm not selling a fantasy — I went through the same grind: tracking meals, showing up when motivation was gone, and learning what actually moves the needle.",
    "That two-month stretch in the photos is real. Consistent training, honest nutrition logging, and habits stacked day by day. RUTINA is the system I wish I had back then — now it's what I use with every client.",
    "When you train here, you're not talking to a faceless app. I review custom plans, run live sessions, and built Coach Alex to keep you accountable between check-ins.",
  ],
  kgLost: 12,
  months: 2,
  imageAlt: "Redjan Tocila — founder transformation from March to May",
};

export const LANDING_HIGHLIGHTS = [
  { icon: Bot, label: "AI meal logging" },
  { icon: LineChart, label: "Macro tracking" },
  { icon: Video, label: "Live sessions" },
  { icon: Target, label: "Custom plans" },
] as const;

export const LANDING_STATS = [
  { value: "2 min", label: "Setup time" },
  { value: "€20", label: "AI from /mo" },
  { value: "AI", label: "Smart coaching" },
  { value: "24/7", label: "Track anytime" },
];

export interface LandingTransformation {
  image: string;
  alt: string;
  kgLost: number;
  months: number;
}

export const LANDING_TRANSFORMATIONS: LandingTransformation[] = [
  {
    image: "/landing/transformations/transformation-01.png",
    alt: "Member body transformation — side profile before and after",
    kgLost: 8,
    months: 3,
  },
  {
    image: "/landing/transformations/transformation-02.png",
    alt: "Member body transformation — front view before and after",
    kgLost: 15,
    months: 5,
  },
  {
    image: "/landing/transformations/transformation-03.png",
    alt: "Member body transformation — side profile before and after",
    kgLost: 10,
    months: 4,
  },
  {
    image: "/landing/transformations/transformation-04.png",
    alt: "Member body transformation — lower body progress before and after",
    kgLost: 6,
    months: 2,
  },
  {
    image: "/landing/transformations/transformation-05.png",
    alt: "Member body transformation — waist progress before and after",
    kgLost: 9,
    months: 3,
  },
  {
    image: "/landing/transformations/transformation-06.png",
    alt: "Member body transformation — midsection progress before and after",
    kgLost: 11,
    months: 4,
  },
  {
    image: "/landing/transformations/transformation-07.png",
    alt: "Member body transformation — full body before and after",
    kgLost: 14,
    months: 6,
  },
  {
    image: "/landing/transformations/transformation-08.png",
    alt: "Member body transformation — back view before and after",
    kgLost: 7,
    months: 3,
  },
  {
    image: "/landing/transformations/transformation-09.png",
    alt: "Member body transformation — side profile before and after",
    kgLost: 12,
    months: 5,
  },
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
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;
