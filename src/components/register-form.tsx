"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMacrosFromIntakeResponses } from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const draft = loadIntakeDraft();
    if (!draft) return;
    setIntakeJson(JSON.stringify(draft));
    const macros = calculateMacrosFromIntakeResponses(draft);
    if (macros) {
      setMacroPreview(
        `${macros.calories} cal · P${macros.protein} C${macros.carbs} F${macros.fat}`
      );
    }
  }, []);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    if (intakeJson) {
      formData.set("intake_json", intakeJson);
    }
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) setError(result.error);
      else clearIntakeDraft();
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-black">
          JOIN <span className="text-primary">LEVELUP</span>
        </CardTitle>
        <CardDescription>
          {intakeJson
            ? "Your custom plan is ready — create your account to unlock it"
            : "Create your account to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intakeJson ? (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Health profile attached
            </div>
            {macroPreview && (
              <p className="mt-1 text-muted-foreground">
                Estimated targets: <span className="font-medium text-foreground">{macroPreview}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-center text-sm text-muted-foreground">
            <p>Want macros & habits tailored to you?</p>
            <Link href="/get-started" className="mt-1 inline-block font-semibold text-primary hover:underline">
              Get your custom plan first →
            </Link>
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
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
            <Input id="phone" name="phone" type="tel" placeholder="+383 44 123 456" />
            <p className="text-xs text-muted-foreground">
              Optional — your coach may reach out if you need support.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account..." : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
