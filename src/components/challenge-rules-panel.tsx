"use client";

import { useEffect, useState } from "react";
import { BookOpen, Scale, ShieldCheck, Trophy, Video, X } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import type { PlatformCopy } from "@/lib/platform-copy";

const ruleIcons = [Scale, ShieldCheck, Video, Trophy] as const;

export function ChallengeRulesButton({ copy }: { copy: PlatformCopy["challenges"] }) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="mr-2 h-4 w-4" />
        {copy.rulesButton}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={platform.aria.close}
            className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-rules-title"
            className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border bg-primary/5 px-5 py-4">
              <div className="min-w-0 pr-4">
                <h2 id="challenge-rules-title" className="text-lg font-black">
                  {copy.rulesTitle}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {copy.rulesIntro}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label={platform.aria.close}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {copy.rules.map((rule, index) => {
                const Icon = ruleIcons[index] ?? Scale;
                return (
                  <div key={rule} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-muted-foreground">{rule}</p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border px-5 py-3">
              <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                {copy.rulesClose}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
