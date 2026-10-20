import {
  Bot,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Clock,
  Dumbbell,
  Flame,
  LineChart,
  MessageCircle,
  Package,
  Play,
  Target,
  Timer,
  Trophy,
  UserPlus,
  Utensils,
  Video,
  Zap,
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

/** Landing funnel label — unlocked after a goal is chosen. */
export const LANDING_PLAN_CTA = "Build my plan";

export const LANDING_HERO_HEADLINE = "Workouts and meals that adjust as you do.";

export const LANDING_HERO_SUBTEXT =
  "Answer a two-minute questionnaire about your goal, equipment and schedule. RUTINA builds your plan, and Coach Alex keeps you on it.";

export interface LandingMainGoal {
  id: string;
  label: string;
  /** Value stored on the intake draft when they continue. */
  intakeGoal: string;
  detail: string;
}

export const LANDING_MAIN_GOALS: LandingMainGoal[] = [
  {
    id: "lose_fat",
    label: "Lose fat",
    intakeGoal: "lose_weight",
    detail: "Burn fat and keep the muscle you have",
  },
  {
    id: "build_muscle",
    label: "Build muscle",
    intakeGoal: "build_muscle",
    detail: "Grow with a plan that matches your week",
  },
  {
    id: "get_stronger",
    label: "Get stronger",
    intakeGoal: "build_muscle",
    detail: "Lift more, with sessions that progress",
  },
  {
    id: "stay_consistent",
    label: "Stay consistent",
    intakeGoal: "stay_fit",
    detail: "Show up on the days you would skip",
  },
];

export interface LandingAlexMessage {
  from: "you" | "alex";
  text: string;
}

export const LANDING_ALEX_SAMPLE = {
  quote: "That push stopped me skipping sessions.",
  name: "Marko D.",
  context: "strength training",
  messages: [
    { from: "you", text: "Skipped legs again. Not feeling it." },
    {
      from: "alex",
      text: "Third week in a row. You told me you wanted a stronger squat by spring. Give me 20 minutes of squats today. Deal?",
    },
    { from: "you", text: "Deal. Logging lunch too." },
    {
      from: "alex",
      text: "Nice. About 540 kcal and 38 g protein. Add eggs tonight and you hit your target.",
    },
  ] satisfies LandingAlexMessage[],
};

export const LANDING_HERO_IMAGE = "/landing/hero.png";
export const LANDING_HERO_MARKETING_IMAGE = "/landing/hero-coach.png";
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
    title: "Your plan",
    description: "Goals and schedule",
  },
  {
    icon: Dumbbell,
    title: "Workouts",
    description: "Sets, reps, demos",
  },
  {
    icon: LineChart,
    title: "Progress",
    description: "Weight and macros",
  },
  {
    icon: CalendarDays,
    title: "Habits",
    description: "Calendar and streaks",
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
    title: "Choose your package",
    subtitle: "AI Pro or Elite",
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
    title: "Your plans",
    tagline: "Build yourself or use AI",
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
    title: "Stay on track",
    description: "Meals, workouts, habits",
  },
  {
    icon: Flame,
    title: "Push harder",
    description: "Real talk, no fluff",
  },
  {
    icon: MessageCircle,
    title: "Built to win",
    description: "Data into action",
  },
  {
    icon: Bot,
    title: "Always on",
    description: "24/7 in your pocket",
  },
];

export interface LandingChallengeType {
  icon: LucideIcon;
  title: string;
  description: string;
  prize: string;
}

export const LANDING_CHALLENGE_TYPES: LandingChallengeType[] = [
  {
    icon: Zap,
    title: "Flash challenges",
    description: "24-hour live events",
    prize: "Shared prize pool",
  },
  {
    icon: Timer,
    title: "Transformation",
    description: "Weeks with the group",
    prize: "Prizes for top ranks",
  },
];

export const LANDING_CHALLENGE_STEPS = [
  {
    title: "Pick",
    description: "Open events",
  },
  {
    title: "Compete",
    description: "Live on camera",
  },
  {
    title: "Win",
    description: "Split the pool",
  },
] as const;

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
    "I logged the meals, did the sessions, and stacked the habits. RUTINA is that system — and it's what I use with every client.",
  ],
  kgLost: 12,
  months: 2,
  imageAlt: "Redjan Tocila — founder transformation from March to May",
};

export const LANDING_HIGHLIGHTS = [
  { icon: Bot, label: "AI meal logging" },
  { icon: LineChart, label: "Macro tracking" },
  { icon: Video, label: "Live sessions" },
  { icon: Target, label: "Your plans" },
] as const;

export const LANDING_HERO_FEATURES = [
  { icon: Dumbbell, label: "Custom workouts", iconClassName: "rotate-45" },
  { icon: Utensils, label: "Simple nutrition", iconClassName: "" },
  { icon: ChartNoAxesColumnIncreasing, label: "Track progress", iconClassName: "" },
  { icon: Play, label: "Live sessions", iconClassName: "" },
] as const;

export const LANDING_HERO_COACH_ROWS = [
  {
    title: "Home workout",
    subtitle: "30 min · Full body",
    image: "/workouts/full-body.jpg",
  },
  {
    title: "Nutrition plan",
    subtitle: "Simple · Real food",
    image: "/dashboard/nutrition.jpg",
  },
  {
    title: "Progress tracking",
    subtitle: "Graphs · Insights",
    image: null,
  },
] as const;

export const LANDING_HERO_STATS = [
  { icon: Clock, value: "2 min", label: "To your plan" },
  { icon: Bot, value: "24/7", label: "AI coaching" },
  { icon: Trophy, value: "Real", label: "Results" },
] as const;

export const LANDING_STATS = [
  { value: "2 min", label: "Setup time" },
  { value: "€19", label: "AI from /mo" },
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
    context: "AI nutrition plan",
    quote:
      "Built a meal plan with AI and dropped it on my calendar. Finally eating for my goal, not vibes.",
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
