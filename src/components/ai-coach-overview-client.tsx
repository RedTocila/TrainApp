"use client";

import Link from "next/link";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Dumbbell,
  FileText,
  Flame,
  Heart,
  Lightbulb,
  LineChart,
  Moon,
  Pill,
  Salad,
  Shield,
  Sparkles,
  Star,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { usePlatformCopy } from "@/components/locale-provider";
import type { MacroGap } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type WeeklyReportPreview = {
  training_score: number | null;
  nutrition_score: number | null;
  consistency_score: number | null;
};

function CreatePlanCard({
  href,
  title,
  description,
  icon: Icon,
  imageSrc,
  accent = "primary",
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Dumbbell;
  imageSrc: string;
  accent?: "primary" | "emerald";
}) {
  const isEmerald = accent === "emerald";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-2xl border p-4",
        "transition-[transform,border-color] duration-200 active:scale-[0.99]",
        isEmerald
          ? "border-emerald-500/35 hover:border-emerald-400/60"
          : "border-primary/35 hover:border-primary/60"
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: `url(${imageSrc})` }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          isEmerald
            ? "bg-gradient-to-br from-background via-background/92 to-emerald-500/25"
            : "bg-gradient-to-br from-background via-background/92 to-primary/25"
        )}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            isEmerald ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:translate-x-0.5",
            isEmerald ? "bg-emerald-500" : "bg-primary"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>

      <div className="relative z-10 mt-6 space-y-1.5">
        <p className="text-sm font-bold leading-snug">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function HelpTile({
  href,
  icon: Icon,
  label,
  desc,
  fadeClass,
  iconWellClass,
  iconClass,
  borderClass,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  desc: string;
  fadeClass: string;
  iconWellClass: string;
  iconClass: string;
  borderClass: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border p-3.5",
        "transition-[transform,border-color] duration-200 active:scale-[0.99]",
        borderClass
      )}
    >
      <div aria-hidden className={cn("absolute inset-0", fadeClass)} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            iconWellClass
          )}
        >
          <Icon className={cn("h-5 w-5", iconClass)} />
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5",
            iconClass
          )}
        />
      </div>
      <div className="relative z-10 mt-4 space-y-1">
        <p className="text-[13px] font-bold leading-snug">{label}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

/** Matches mockup: icon in ring center, caption below (e.g. 4/7 Stërvitje). */
function WeekStatRing({
  value,
  max,
  icon: Icon,
  caption,
  colorClass,
}: {
  value: number;
  max: number;
  icon: typeof Flame;
  caption: string;
  colorClass: string;
}) {
  const r = 28;
  const stroke = 4;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference - pct * circumference;
  const viewPad = stroke + 2;
  const viewSize = 2 * (r + viewPad);
  const viewMin = 50 - r - viewPad;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative h-16 w-16">
        <svg
          className="h-full w-full -rotate-90"
          viewBox={`${viewMin} ${viewMin} ${viewSize} ${viewSize}`}
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-foreground/15"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={colorClass}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={cn("h-5 w-5", colorClass)} />
        </div>
      </div>
      <p className="max-w-[4.75rem] text-[11px] font-semibold leading-tight text-foreground/80">
        {caption}
      </p>
    </div>
  );
}

const FAQ_ICONS = [Flame, Dumbbell, Moon, Pill] as const;
const TOPIC_ICONS = [Zap, Dumbbell, Salad, Heart] as const;

export function AiCoachOverviewClient({
  firstName,
  insightMessage,
  gap,
  workoutsThisWeek,
  daysTracked,
  report,
}: {
  firstName: string;
  insightMessage: string;
  gap: MacroGap | null;
  workoutsThisWeek: number;
  daysTracked: number;
  report: WeeklyReportPreview | null;
}) {
  const platform = usePlatformCopy();
  const ai = platform.ai;
  const { openChat } = useAiCoachChat();

  const tipText =
    insightMessage && insightMessage !== ai.logMealsGuidance
      ? insightMessage
      : ai.tipFallback;

  const scores = [
    report?.training_score,
    report?.nutrition_score,
    report?.consistency_score,
  ].filter((v): v is number => typeof v === "number");
  const overallScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
      : null;

  const nutritionPct =
    gap && gap.targets.calories > 0
      ? Math.min(100, Math.round((gap.consumed.calories / gap.targets.calories) * 100))
      : report?.nutrition_score ?? 0;

  return (
    <div className="space-y-7">
      {/* Hero + command bar */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <AiCoachAvatar className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                {ai.hello(firstName)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{ai.hereForYou}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openChat()}
            aria-label={ai.startChatting}
            className={cn(
              "chat-command-shell grid w-full max-w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1",
              "rounded-full border border-primary/45 bg-secondary/50 p-1.5 pl-2 shadow-sm backdrop-blur-sm",
              "transition-colors hover:border-primary/70 hover:bg-secondary/70 active:scale-[0.99]"
            )}
          >
            <span className="col-start-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="col-start-2 row-start-1 min-w-0 truncate px-1 text-left text-sm text-foreground/75">
              {ai.placeholder}
            </span>
            <span className="col-start-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_14px_rgba(var(--primary-rgb),0.4)]">
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </button>

          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ai.quickTopics.map((topic, index) => {
              const Icon = TOPIC_ICONS[index] ?? Sparkles;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => openChat(topic.prompt)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5",
                    "text-xs font-semibold text-foreground transition-colors",
                    "hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {topic.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How can I help — above Create with AI, fade cards */}
      <section className="space-y-3">
        <h3 className="text-base font-bold">{ai.howCanIHelp}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <HelpTile
            href="/dashboard/ai/predictions"
            icon={LineChart}
            label={ai.helpTiles.progress.label}
            desc={ai.helpTiles.progress.desc}
            fadeClass="bg-gradient-to-br from-background via-background/90 to-amber-500/20"
            iconWellClass="bg-amber-500/20"
            iconClass="text-amber-500"
            borderClass="border-amber-500/30 hover:border-amber-400/55"
          />
          <HelpTile
            href="/dashboard/ai/recommendations"
            icon={Lightbulb}
            label={ai.helpTiles.tips.label}
            desc={ai.helpTiles.tips.desc}
            fadeClass="bg-gradient-to-br from-background via-background/90 to-violet-500/20"
            iconWellClass="bg-violet-500/20"
            iconClass="text-violet-400"
            borderClass="border-violet-500/30 hover:border-violet-400/55"
          />
          <HelpTile
            href="/dashboard/ai/reports"
            icon={FileText}
            label={ai.helpTiles.weeklyReport.label}
            desc={ai.helpTiles.weeklyReport.desc}
            fadeClass="bg-gradient-to-br from-background via-background/90 to-sky-500/20"
            iconWellClass="bg-sky-500/20"
            iconClass="text-sky-400"
            borderClass="border-sky-500/30 hover:border-sky-400/55"
          />
          <HelpTile
            href="/dashboard/ai/meal-suggestions"
            icon={UtensilsCrossed}
            label={ai.helpTiles.mealIdeas.label}
            desc={ai.helpTiles.mealIdeas.desc}
            fadeClass="bg-gradient-to-br from-background via-background/90 to-rose-500/20"
            iconWellClass="bg-rose-500/20"
            iconClass="text-rose-400"
            borderClass="border-rose-500/30 hover:border-rose-400/55"
          />
        </div>
      </section>

      {/* Create with AI */}
      <section className="space-y-3">
        <h3 className="text-base font-bold">{ai.buildPlan}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CreatePlanCard
            href="/dashboard/ai/plans/workout"
            title={ai.buildWorkoutWithAi}
            description={ai.buildWorkoutWithAiDesc}
            icon={Dumbbell}
            imageSrc="/ai-coach/create-workout.jpg"
            accent="primary"
          />
          <CreatePlanCard
            href="/dashboard/ai/plans/nutrition"
            title={ai.buildNutritionWithAi}
            description={ai.buildNutritionWithAiDesc}
            icon={Salad}
            imageSrc="/ai-coach/create-nutrition.jpg"
            accent="emerald"
          />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          {ai.createPrivacyNote}
        </p>
      </section>

      {/* Weekly progress — mockup style */}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
          <h3 className="text-base font-bold">{ai.progressThisWeek}</h3>
          <Link
            href="/dashboard/ai/reports"
            className="text-xs font-semibold text-primary"
          >
            {ai.seeMore} →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 pb-5 pt-3 sm:px-4">
          <WeekStatRing
            value={workoutsThisWeek}
            max={7}
            icon={Flame}
            colorClass="text-orange-500"
            caption={`${workoutsThisWeek}/7 ${ai.workoutsThisWeek}`}
          />
          <WeekStatRing
            value={daysTracked}
            max={7}
            icon={Check}
            colorClass="text-sky-500"
            caption={`${daysTracked} ${ai.daysTracked}`}
          />
          <WeekStatRing
            value={nutritionPct}
            max={100}
            icon={Check}
            colorClass="text-emerald-500"
            caption={`${nutritionPct}% ${ai.nutrition}`}
          />
          <WeekStatRing
            value={overallScore ?? 0}
            max={100}
            icon={Star}
            colorClass="text-amber-500"
            caption={`${overallScore ?? "—"} ${ai.score}`}
          />
        </div>
      </section>

      {/* FAQs — open chat + auto-generate */}
      <section className="space-y-3">
        <h3 className="text-base font-bold">{ai.faqsTitle}</h3>
        <div className="space-y-2">
          {ai.faqItems.map((item, index) => {
            const Icon = FAQ_ICONS[index] ?? Sparkles;
            return (
              <button
                key={item.question}
                type="button"
                onClick={() => openChat(item.prompt)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-left",
                  "shadow-sm transition-[transform,border-color,background-color] duration-200",
                  "hover:border-primary/40 hover:bg-secondary/40 active:scale-[0.99]"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  {item.question}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Tip of the day */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-primary/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-3 right-3 text-7xl font-black leading-none text-primary/15"
        >
          ”
        </span>
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_18px_rgba(var(--primary-rgb),0.35)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1.5 pr-6">
            <p className="text-sm font-bold text-primary">{ai.tipOfTheDay}</p>
            <p className="text-sm leading-relaxed text-foreground/90">{tipText}</p>
          </div>
        </div>
      </section>

      <div className="h-16 lg:h-8" aria-hidden />
    </div>
  );
}
