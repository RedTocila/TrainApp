"use client";

import Image from "next/image";
import { ArrowLeft, Camera, MessageCircle, Mic, SquarePen } from "lucide-react";
import { AiCoachAvatar, getAiCoachAvatarSrc } from "@/components/ai-coach-avatar";
import { FadeIn } from "@/components/landing/landing-motion";
import { useTheme } from "@/components/theme-provider";
import { COACH_ALEX_HIGHLIGHTS, LANDING_ALEX_SAMPLE } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingCoachAlex() {
  const { accentColor } = useTheme();
  const avatarSrc = getAiCoachAvatarSrc(accentColor);

  return (
    <section
      id="coach-alex"
      className="landing-deferred-section scroll-mt-24 border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="mx-auto w-full max-w-sm text-center">
          <FadeIn className="relative">
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-primary/25 blur-3xl" />
            <div className="relative mx-auto aspect-square w-full max-w-[16rem] sm:max-w-xs">
              <Image
                key={avatarSrc}
                src={avatarSrc}
                alt="Coach Alex — your AI fitness coach"
                fill
                sizes="(min-width: 640px) 320px, 70vw"
                className="rounded-full object-cover"
              />
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Your coach who helps you
              <span className="block text-primary">show up and win</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Honest feedback when you want to skip.
            </p>
          </FadeIn>

          <ul className="mt-6 grid grid-cols-2 gap-3 text-left">
            {COACH_ALEX_HIGHLIGHTS.map((item, i) => (
              <FadeIn key={item.title} delay={0.05 * (i + 1)}>
                <li className="h-full rounded-2xl border border-border bg-card/70 p-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-tight">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </li>
              </FadeIn>
            ))}
          </ul>
        </div>

        <FadeIn className="mx-auto w-full max-w-md">
          <AlexChatSample />
        </FadeIn>
      </div>
    </section>
  );
}

function AlexChatSample() {
  return (
    <div>
      <blockquote className="mb-4 text-left">
        <p className="text-lg font-bold leading-snug tracking-tight">
          “{LANDING_ALEX_SAMPLE.quote}”
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{LANDING_ALEX_SAMPLE.name}</span>
          {" · "}
          {LANDING_ALEX_SAMPLE.context}
        </p>
      </blockquote>

      <div
        className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-black text-white shadow-[0_24px_70px_-28px_rgba(0,0,0,0.65)]"
        aria-label="Sample check-in with Coach Alex"
      >
        <div className="flex items-center justify-between gap-3 bg-black px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-300" aria-hidden>
              <ArrowLeft className="h-4 w-4" />
            </span>
            <AiCoachAvatar size="sm" className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-base font-bold">Coach Alex</p>
              <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Online
              </p>
            </div>
          </div>
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300"
            aria-hidden
          >
            <SquarePen className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </div>

        <div className="space-y-4 bg-black p-4">
          {LANDING_ALEX_SAMPLE.messages.map((message) => (
            <div
              key={message.text}
              className={cn(
                "flex gap-2.5",
                message.from === "you" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {message.from === "alex" ? (
                <AiCoachAvatar size="xs" className="mt-0.5 h-8 w-8 shrink-0" />
              ) : null}
              <div
                className={cn(
                  "max-w-[88%] px-4 py-3 text-sm leading-relaxed",
                  message.from === "you" ? "chat-bubble-user" : "chat-bubble-assistant"
                )}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-black px-3 pb-3" aria-hidden>
          <div className="chat-composer-minimal grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-full px-1.5 py-1.5">
            <span className="flex h-9 items-center gap-1 rounded-full bg-[#1B3326] px-2.5 text-[11px] font-semibold text-[#62C471]">
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
              Ask
            </span>
            <span className="min-w-0 truncate px-1 text-sm text-zinc-500">Ask Alex…</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400">
              <Camera className="h-4 w-4" />
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_14px_rgba(var(--primary-rgb),0.45)]">
              <Mic className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
