"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Dumbbell,
  CheckCircle2,
  Loader2,
  ArrowRight,
  TicketPercent,
} from "lucide-react";
import { registerFreeAccount } from "@/lib/actions/auth";
import { OpenInAppDialog } from "@/components/open-in-app-dialog";
import { isNativeApp } from "@/lib/native-app";
import { BrandWordmark } from "@/components/app-logo";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateMacrosFromIntakeResponses,
  type MacroTargets,
} from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import {
  starterProgramPreview,
  type StarterProgramPreview,
} from "@/lib/intake-starter-program";
import { loadCheckoutReferralCode, saveCheckoutReferralCode } from "@/lib/referral-storage";
import { REFERRALS_ENABLED } from "@/lib/referral";
import { formatUserError } from "@/lib/format-user-error";
import { cn } from "@/lib/utils";
import { isSoldPlanId, type BillingInterval } from "@/lib/subscription-plans";
import { IOS_WELCOME_PATH } from "@/lib/ios-routes";

function WorkoutPreviewRow({ preview }: { preview: StarterProgramPreview }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
        <Dumbbell className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-200/90">
          Workout program
        </p>
        <p className="text-sm font-semibold leading-snug">
          {preview.daysPerWeek} days/week · {preview.weekdayLabels.join(", ")}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {preview.experience} · {preview.equipment}. Each day is a warm-up, full workout, and stretch — {preview.sessions} sessions land on your calendar right after signup.
        </p>
      </div>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [workoutPreview, setWorkoutPreview] = useState<StarterProgramPreview | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [readyEmail, setReadyEmail] = useState<string | null>(null);

  const requestedPlan = searchParams.get("plan") ?? "";
  const requestedInterval = searchParams.get("interval") === "annual" ? "annual" : "monthly";

  useEffect(() => {
    try {
      const draft = loadIntakeDraft();
      if (!draft) return;
      setIntakeJson(JSON.stringify(draft));
      const macros = calculateMacrosFromIntakeResponses(draft);
      if (macros) setMacroTargets(macros);
      setWorkoutPreview(starterProgramPreview(draft));
    } catch {
      // Corrupt local draft must never block account creation.
    }
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      const normalized = ref.trim();
      saveCheckoutReferralCode(normalized);
      setReferralCode(normalized);
      return;
    }
    const stored = loadCheckoutReferralCode();
    if (stored?.trim()) setReferralCode(stored.trim());
  }, [searchParams]);

  const backHref =
    searchParams.get("from") === "ios"
      ? IOS_WELCOME_PATH
      : intakeJson
        ? "/get-started"
        : "/";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const fullName = (formData.get("full_name") as string).trim();
    const email = (formData.get("email") as string).trim().toLowerCase();
    const phone = ((formData.get("phone") as string) || "").trim() || null;
    const password = formData.get("password") as string;
    const normalizedReferralCode = REFERRALS_ENABLED
      ? referralCode.trim() || null
      : null;
    if (normalizedReferralCode) saveCheckoutReferralCode(normalizedReferralCode);

    setIsPending(true);
    try {
      const result = await registerFreeAccount({
        fullName,
        email,
        phone,
        password,
        intakeJson,
        referralCode: normalizedReferralCode,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      clearIntakeDraft();
      if (result.role === "admin") {
        router.push("/admin");
        return;
      }
      if (isSoldPlanId(requestedPlan)) {
        const interval: BillingInterval = requestedInterval;
        router.push(`/dashboard/checkout?plan=${requestedPlan}&interval=${interval}`);
        return;
      }
      if (isNativeApp()) {
        router.push("/dashboard");
        return;
      }
      setReadyEmail(email);
    } catch (err) {
      setError(formatUserError(err, "Could not create your account. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  if (readyEmail !== null) {
    return (
      <>
        <AuthCardShell backHref="/">
          <Card className="w-full border-border/80 bg-background/95 shadow-xl backdrop-blur">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-black">You&apos;re in</CardTitle>
              <CardDescription>Your free account is ready. No card required.</CardDescription>
            </CardHeader>
          </Card>
        </AuthCardShell>
        <OpenInAppDialog
          email={readyEmail}
          onContinue={() => router.push("/dashboard")}
        />
      </>
    );
  }

  return (
    <AuthCardShell backHref={backHref}>
      <Card className="w-full border-border/80 bg-background/95 shadow-xl backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">
            JOIN <BrandWordmark />
          </CardTitle>
          <CardDescription>
            {intakeJson
              ? "Your preferences are saved. Create a free account — no card required."
              : "Create a free account. Upgrade to Plus or Pro later on this website."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {intakeJson ? (
            <div className="mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
              <div className="flex items-center gap-2 border-b border-primary/20 px-3.5 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">Health profile ready</p>
                  <p className="text-[11px] text-muted-foreground">
                    Daily targets and a 4-week workout from your questionnaire
                  </p>
                </div>
              </div>
              {macroTargets ? (
                <div className="space-y-3 p-3.5">
                  <div className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Daily calories
                      </p>
                      <p className="text-xl font-black leading-none tracking-tight">
                        {macroTargets.calories}
                        <span className="ml-1 text-sm font-semibold text-muted-foreground">kcal</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: "protein", label: "Protein", value: macroTargets.protein, icon: Beef, color: "text-rose-400", bg: "bg-rose-500/15", bar: "bg-rose-500" },
                        { key: "carbs", label: "Carbs", value: macroTargets.carbs, icon: Wheat, color: "text-amber-400", bg: "bg-amber-500/15", bar: "bg-amber-500" },
                        { key: "fat", label: "Fat", value: macroTargets.fat, icon: Droplets, color: "text-sky-400", bg: "bg-sky-500/15", bar: "bg-sky-500" },
                      ] as const
                    ).map((macro) => {
                      const Icon = macro.icon;
                      const max = Math.max(macroTargets.protein, macroTargets.carbs, macroTargets.fat, 1);
                      const width = Math.max(12, (macro.value / max) * 100);
                      return (
                        <div key={macro.key} className="rounded-xl border border-border/60 bg-background/40 px-2.5 py-2.5">
                          <div className={cn("mb-2 flex h-7 w-7 items-center justify-center rounded-lg", macro.bg, macro.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{macro.label}</p>
                          <p className="mt-0.5 text-base font-black leading-none">
                            {macro.value}
                            <span className="text-xs font-semibold text-muted-foreground">g</span>
                          </p>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                            <div className={cn("h-full rounded-full", macro.bar)} style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {workoutPreview ? <WorkoutPreviewRow preview={workoutPreview} /> : null}
                </div>
              ) : (
                <div className="space-y-3 p-3.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Your answers are saved and ready to apply.
                  </div>
                  {workoutPreview ? <WorkoutPreviewRow preview={workoutPreview} /> : null}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-center text-sm text-muted-foreground">
              <p>Want macros and habits tailored to you?</p>
              <Link href="/get-started" className="mt-1 inline-block font-semibold text-primary hover:underline">
                Get Your Custom Program first →
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" required placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+355 11 222 333 (Optional)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" name="password" required minLength={6} />
            </div>
            {REFERRALS_ENABLED ? (
            <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <TicketPercent className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Referral code</p>
                  <p className="text-xs text-muted-foreground">Optional — used when you upgrade</p>
                </div>
              </div>
              <Input
                id="guest-referral-code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter code (Optional)"
                autoCapitalize="characters"
                autoCorrect="off"
                className="h-11"
              />
            </div>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-3">
              <input
                id="accept_terms"
                name="accept_terms"
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isPending || !acceptedTerms}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your account...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {isSoldPlanId(requestedPlan) ? "Create account and continue" : "Create free account"}
                </>
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={searchParams.get("from") === "ios" ? "/login?from=ios&next=%2Fdashboard" : "/login"}
              className="text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthCardShell>
  );
}
