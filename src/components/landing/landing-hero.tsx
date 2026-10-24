"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, Flame, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANDING_HERO_SUBTEXT,
  LANDING_MAIN_GOALS,
  LANDING_PLAN_CTA,
  type LandingMainGoal,
} from "@/lib/landing-content";

const GOAL_ICONS = {
  lose_fat: Flame,
  build_muscle: Dumbbell,
  get_stronger: Zap,
  stay_consistent: Target,
} as const;

export function LandingHero({
  goalId,
  onGoalChange,
  onContinue,
  ctaRef,
}: {
  goalId: string | null;
  onGoalChange: (id: string) => void;
  onContinue: () => void;
  ctaRef: RefObject<HTMLButtonElement | null>;
}) {
  const selected = LANDING_MAIN_GOALS.find((goal) => goal.id === goalId) ?? null;

  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-[calc(4.5rem+1.25rem)] sm:px-6 sm:pt-[calc(4.5rem+2.5rem)] lg:pb-24">
      <HeroArcs />

      <div className="relative z-10 mx-auto max-w-3xl">
        <div>
          <h1 className="max-w-xl text-[2.65rem] font-black leading-[0.98] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
            Workouts and meals that{" "}
            <span className="text-primary">adjust as you do.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {LANDING_HERO_SUBTEXT}
          </p>

          <GoalPicker goalId={goalId} onGoalChange={onGoalChange} />

          <div className="mt-5 max-w-2xl">
            <button
              ref={ctaRef}
              type="button"
              onClick={onContinue}
              className="group landing-cta-loop flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground shadow-[0_16px_40px_-12px_rgba(var(--primary-rgb),0.85)] transition-all hover:brightness-110 active:scale-[0.99] sm:h-16 sm:text-lg"
            >
              {LANDING_PLAN_CTA}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            {selected ? (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Starting with {selected.label.toLowerCase()}.
              </p>
            ) : null}
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Takes 2 minutes. Free to start.
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Already a member?{" "}
              <Link
                href="/login"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GoalPicker({
  goalId,
  onGoalChange,
}: {
  goalId: string | null;
  onGoalChange: (id: string) => void;
}) {
  return (
    <fieldset id="main-goal" className="mt-8 max-w-2xl scroll-mt-28">
      <legend className="text-lg font-bold tracking-tight text-foreground">
        What&apos;s your main goal?
      </legend>
      <div
        className="mt-3 grid grid-cols-2 gap-2.5"
        role="radiogroup"
        aria-label="What's your main goal?"
      >
        {LANDING_MAIN_GOALS.map((goal) => (
          <GoalOption
            key={goal.id}
            goal={goal}
            selected={goalId === goal.id}
            onSelect={() => onGoalChange(goal.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function GoalOption({
  goal,
  selected,
  onSelect,
}: {
  goal: LandingMainGoal;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = GOAL_ICONS[goal.id as keyof typeof GOAL_ICONS] ?? Target;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex h-12 items-center gap-2 rounded-2xl border px-2.5 text-left transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_30px_-16px_rgba(var(--primary-rgb),0.9)]"
          : "border-border/80 bg-card/75 hover:border-primary/45 hover:bg-card"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary-foreground/15" : "bg-primary/15 text-primary"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="truncate text-sm font-bold leading-none">{goal.label}</span>
    </button>
  );
}

function HeroArcs() {
  return (
    <div
      className="pointer-events-none absolute -right-40 -top-48 h-[30rem] w-[30rem] sm:-right-24 sm:-top-40 lg:h-[42rem] lg:w-[42rem]"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full border-[28px] border-primary/25 blur-[2px]" />
      <div className="absolute inset-12 rounded-full border-[18px] border-primary/40 shadow-[0_0_60px_rgba(var(--primary-rgb),0.45)]" />
      <div className="absolute inset-24 rounded-full border-2 border-primary/30" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(var(--primary-rgb),0.18),transparent_65%)]" />
    </div>
  );
}

export function LandingStickyCta({
  goalId,
  visible,
  onContinue,
}: {
  goalId: string | null;
  visible: boolean;
  onContinue: () => void;
}) {
  const selected = LANDING_MAIN_GOALS.find((goal) => goal.id === goalId) ?? null;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  if (!rendered) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-transform duration-300 sm:px-4",
        visible ? "translate-y-0" : "pointer-events-none translate-y-[120%]"
      )}
      onTransitionEnd={() => {
        if (!visible) setRendered(false);
      }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-full border border-border/80 bg-background/95 p-1.5 pl-4 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            document.getElementById("main-goal")?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
        >
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {selected ? "Your goal" : "Takes 2 minutes"}
          </p>
          {selected ? (
            <p className="truncate text-sm font-bold text-foreground">{selected.label}</p>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="landing-cta-loop inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          {LANDING_PLAN_CTA}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
