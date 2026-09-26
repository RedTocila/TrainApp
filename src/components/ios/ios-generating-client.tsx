"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { applyPendingIntakeDraft } from "@/lib/actions/client-intake";
import { isIntakeResponsesComplete } from "@/lib/intake-questionnaire";
import { clearIntakeDraft, loadIntakeDraft } from "@/lib/intake-storage";
import { cn } from "@/lib/utils";

const STEPS = [
  "Personalizing your workouts",
  "Setting up your training schedule",
  "Preparing your nutrition",
  "Configuring your AI Coach",
] as const;

/**
 * Native plan-generation experience. Same dark/red funnel language as JOIN.
 */
export function IosGeneratingClient() {
  const router = useRouter();
  const started = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    const timers: number[] = [];

    const advanceVisual = () => {
      STEPS.forEach((_, i) => {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) setActiveIndex(i);
          }, 450 + i * 700)
        );
      });
    };

    advanceVisual();

    void (async () => {
      try {
        const draft = loadIntakeDraft();
        if (draft && isIntakeResponsesComplete(draft)) {
          const result = await applyPendingIntakeDraft(JSON.stringify(draft));
          if (result && "error" in result && result.error) {
            if (!cancelled) setError(result.error);
            return;
          }
          clearIntakeDraft();
        }

        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            setDone(true);
            setActiveIndex(STEPS.length - 1);
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) router.replace("/dashboard");
              }, 600)
            );
          }, 450 + STEPS.length * 700)
        );
      } catch {
        if (!cancelled) {
          setError("Something went wrong building your plan. Opening Home…");
          timers.push(
            window.setTimeout(() => {
              if (!cancelled) router.replace("/dashboard");
            }, 1400)
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [router]);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          RUTINA
        </p>
        <h1 className="mt-3 text-center text-2xl font-black tracking-tight text-zinc-50">
          Building your RUTINA
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Personalizing workouts, nutrition, and your AI Coach.
        </p>

        <ul className="mt-10 space-y-3">
          {STEPS.map((label, index) => {
            const complete = done || index < activeIndex;
            const current = !done && index === activeIndex;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  complete || current
                    ? "border-primary/40 bg-primary/10"
                    : "border-zinc-800 bg-zinc-900/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    complete
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-zinc-800 text-primary"
                        : "bg-zinc-900 text-zinc-600"
                  )}
                >
                  {complete ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : current ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    complete || current ? "text-zinc-100" : "text-zinc-500"
                  )}
                >
                  {complete ? `✓ ${label}` : label}
                </span>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-400">{error}</p>
        ) : null}
      </motion.div>
    </div>
  );
}
