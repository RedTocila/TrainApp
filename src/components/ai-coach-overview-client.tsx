"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUp,
  BarChart3,
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
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { usePlatformCopy } from "@/components/locale-provider";
import type { MacroGap } from "@/lib/ai/types";
import { buildPricingHref } from "@/lib/pricing-nav";
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
  accent = "primary",
  backgroundImage,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Dumbbell;
  accent?: "primary" | "emerald";
  backgroundImage: string;
}) {
  const isEmerald = accent === "emerald";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-sm",
        "transition-[transform,border-color] duration-200 active:scale-[0.99]",
        isEmerald
          ? "border-emerald-500/35 hover:border-emerald-400/60"
          : "border-primary/35 hover:border-primary/60"
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-right"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Accent wash so the photo matches the card border color */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br via-transparent to-transparent",
          isEmerald ? "from-emerald-500/45" : "from-primary/45"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          isEmerald ? "from-emerald-950/55" : "from-primary/40"
        )}
      />
      {/* Keep left text readable; right side shows the photo */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-black/80 from-0% via-black/50 via-[42%] to-transparent to-[68%]"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl",
          isEmerald ? "bg-emerald-400/30" : "bg-primary/30"
        )}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm",
            isEmerald ? "bg-emerald-500/25 text-emerald-300" : "bg-primary/25 text-primary"
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

      <div className="relative z-10 mt-5 max-w-[70%] space-y-1.5 text-white">
        <p className="text-sm font-bold leading-snug drop-shadow-sm">{title}</p>
        <p className="text-xs leading-relaxed text-white/75">{description}</p>
      </div>
    </Link>
  );
}

function HelpTile({
  href,
  icon: Icon,
  label,
  desc,
  iconWellClass,
  iconClass,
  borderClass,
  washClass,
  glowClass,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  desc: string;
  iconWellClass: string;
  iconClass: string;
  borderClass: string;
  washClass: string;
  glowClass: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl border bg-card p-3.5 shadow-sm",
        "transition-[transform,border-color] duration-200 active:scale-[0.99]",
        borderClass
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br via-card to-card", washClass)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl",
          glowClass
        )}
      />

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
      <div className="relative z-10 mt-3 space-y-1">
        <p className="text-[13px] font-bold leading-snug">{label}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

function WeeklyProgressCard({
  workoutsThisWeek,
  daysTracked,
  nutritionPct,
  weekDaysCompleted,
}: {
  workoutsThisWeek: number;
  daysTracked: number;
  nutritionPct: number;
  weekDaysCompleted: boolean[];
}) {
  const platform = usePlatformCopy();
  const ai = platform.ai;
  const days = ai.weekDayLabels;

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
          <BarChart3 className="h-4 w-4 text-primary" />
        </span>
        <h3 className="text-base font-bold">{ai.progressThisWeek}</h3>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/70">
        <div className="px-2 text-center first:pl-0 last:pr-0">
          <p className="text-2xl font-black tabular-nums text-primary sm:text-3xl">
            {workoutsThisWeek}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {ai.workoutsThisWeek}
          </p>
        </div>
        <div className="px-2 text-center">
          <p className="text-2xl font-black tabular-nums text-amber-500 sm:text-3xl">
            {daysTracked}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {ai.daysTracked}
          </p>
        </div>
        <div className="px-2 text-center">
          <p className="text-2xl font-black tabular-nums text-emerald-500 sm:text-3xl">
            {nutritionPct}%
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {ai.nutrition}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((label, index) => {
          const done = weekDaysCompleted[index] ?? false;
          return (
            <div key={`${label}-${index}`} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {label}
              </span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-transparent text-transparent"
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </div>
          );
        })}
      </div>
    </section>
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
  weekDaysCompleted,
  report,
  requiresUpgrade = false,
}: {
  firstName: string;
  insightMessage: string;
  gap: MacroGap | null;
  workoutsThisWeek: number;
  daysTracked: number;
  weekDaysCompleted: boolean[];
  report: WeeklyReportPreview | null;
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();
  const ai = platform.ai;
  const pathname = usePathname();
  const router = useRouter();
  const { openChat } = useAiCoachChat();
  const pricingHref = buildPricingHref(pathname);

  const tipText =
    insightMessage && insightMessage !== ai.logMealsGuidance
      ? insightMessage
      : ai.tipFallback;

  const nutritionPct =
    gap && gap.targets.calories > 0
      ? Math.min(100, Math.round((gap.consumed.calories / gap.targets.calories) * 100))
      : report?.nutrition_score ?? 0;

  const featureHref = (href: string) => (requiresUpgrade ? pricingHref : href);
  const onLockedAction = () => {
    if (requiresUpgrade) {
      router.push(pricingHref);
      return true;
    }
    return false;
  };

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
            onClick={() => {
              if (onLockedAction()) return;
              openChat();
            }}
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
                  onClick={() => {
                    if (onLockedAction()) return;
                    openChat(topic.prompt);
                  }}
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

      {/* How can I help */}
      <section className="space-y-3">
        <h3 className="text-base font-bold">{ai.howCanIHelp}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <HelpTile
            href={featureHref("/dashboard/ai/predictions")}
            icon={LineChart}
            label={ai.helpTiles.progress.label}
            desc={ai.helpTiles.progress.desc}
            iconWellClass="bg-amber-500/15"
            iconClass="text-amber-500"
            borderClass="border-amber-500/30 hover:border-amber-400/55"
            washClass="from-amber-500/18"
            glowClass="bg-amber-400/30"
          />
          <HelpTile
            href={featureHref("/dashboard/ai/recommendations")}
            icon={Lightbulb}
            label={ai.helpTiles.tips.label}
            desc={ai.helpTiles.tips.desc}
            iconWellClass="bg-violet-500/15"
            iconClass="text-violet-400"
            borderClass="border-violet-500/30 hover:border-violet-400/55"
            washClass="from-violet-500/18"
            glowClass="bg-violet-400/30"
          />
          <HelpTile
            href={featureHref("/dashboard/ai/reports")}
            icon={FileText}
            label={ai.helpTiles.weeklyReport.label}
            desc={ai.helpTiles.weeklyReport.desc}
            iconWellClass="bg-cyan-500/15"
            iconClass="text-cyan-400"
            borderClass="border-cyan-500/35 hover:border-cyan-400/60"
            washClass="from-cyan-500/18"
            glowClass="bg-cyan-400/30"
          />
          <HelpTile
            href={featureHref("/dashboard/ai/meal-suggestions")}
            icon={UtensilsCrossed}
            label={ai.helpTiles.mealIdeas.label}
            desc={ai.helpTiles.mealIdeas.desc}
            iconWellClass="bg-rose-500/15"
            iconClass="text-rose-400"
            borderClass="border-rose-500/30 hover:border-rose-400/55"
            washClass="from-rose-500/18"
            glowClass="bg-rose-400/30"
          />
        </div>
      </section>

      {/* Create with AI */}
      <section className="space-y-3">
        <h3 className="text-base font-bold">{ai.buildPlan}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CreatePlanCard
            href={featureHref("/dashboard/ai/plans/workout")}
            title={ai.buildWorkoutWithAi}
            description={ai.buildWorkoutWithAiDesc}
            icon={Dumbbell}
            accent="primary"
            backgroundImage="/ai-coach/create-workout.png"
          />
          <CreatePlanCard
            href={featureHref("/dashboard/ai/plans/nutrition")}
            title={ai.buildNutritionWithAi}
            description={ai.buildNutritionWithAiDesc}
            icon={Salad}
            accent="emerald"
            backgroundImage="/ai-coach/create-nutrition.png"
          />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          {ai.createPrivacyNote}
        </p>
      </section>

      {/* Weekly progress */}
      <WeeklyProgressCard
        workoutsThisWeek={workoutsThisWeek}
        daysTracked={daysTracked}
        nutritionPct={nutritionPct}
        weekDaysCompleted={weekDaysCompleted}
      />

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
                onClick={() => {
                  if (onLockedAction()) return;
                  openChat(item.prompt);
                }}
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
