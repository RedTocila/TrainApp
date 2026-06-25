"use client";

import { useState, useTransition } from "react";
import { CHECKOUT_LOCALES } from "@/lib/checkout-i18n";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { updateProfile, updatePassword } from "@/lib/actions/profile";
import { usePlatformCopy } from "@/components/locale-provider";
import { AccentColorPicker } from "@/components/accent-color-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GOAL_KEYS = [
  "none",
  "lose_weight",
  "build_muscle",
  "stay_fit",
  "improve_endurance",
  "general_health",
] as const;

export function ProfileSettings({
  fullName,
  email,
  phone,
  goal,
  preferredLocale = "al",
  unitSystem = "metric",
  showHeader = true,
}: {
  fullName: string;
  email: string;
  phone?: string | null;
  goal: string | null;
  preferredLocale?: CheckoutLocale;
  unitSystem?: "metric" | "imperial";
  showHeader?: boolean;
}) {
  const platform = usePlatformCopy();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const handleProfileSubmit = (formData: FormData) => {
    setProfileError(null);
    setProfileSuccess(false);
    startProfileTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        setProfileError(result.error);
      } else {
        setProfileSuccess(true);
      }
    });
  };

  const handlePasswordSubmit = (formData: FormData) => {
    setPasswordError(null);
    setPasswordSuccess(false);
    startPasswordTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) {
        setPasswordError(result.error);
      } else {
        setPasswordSuccess(true);
      }
    });
  };

  return (
    <>
      {showHeader && (
        <div>
          <h1 className="text-2xl font-black">{platform.profile.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {platform.profile.manageAccount}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{platform.profile.personalInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{platform.settings.fullName}</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={fullName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{platform.settings.email}</Label>
              <Input id="email" value={email} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{platform.settings.phone}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={phone ?? ""}
                placeholder="+383 44 123 456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">{platform.settings.fitnessGoal}</Label>
              <select
                id="goal"
                name="goal"
                defaultValue={goal ?? ""}
                className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {GOAL_KEYS.map((key) => (
                  <option key={key} value={key === "none" ? "" : key}>
                    {platform.goals[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_locale">{platform.settings.language}</Label>
              <select
                id="preferred_locale"
                name="preferred_locale"
                defaultValue={preferredLocale}
                className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CHECKOUT_LOCALES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_system">{platform.settings.units}</Label>
              <select
                id="unit_system"
                name="unit_system"
                defaultValue={unitSystem}
                className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="metric">{platform.settings.metric}</option>
                <option value="imperial">{platform.settings.imperial}</option>
              </select>
            </div>
            {profileError && (
              <p className="text-sm text-red-400">{profileError}</p>
            )}
            {profileSuccess && (
              <p className="text-sm text-green-400">{platform.settings.profileUpdated}</p>
            )}
            <Button type="submit" disabled={isProfilePending}>
              {isProfilePending ? platform.settings.saving : platform.settings.saveChanges}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{platform.profile.appearance}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">{platform.settings.theme}</p>
            <ThemeToggle variant="segmented" />
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">{platform.settings.accentColor}</p>
            <AccentColorPicker />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{platform.profile.password}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">{platform.settings.newPassword}</Label>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">{platform.settings.confirmPassword}</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                minLength={6}
                required
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-400">{platform.settings.passwordUpdated}</p>
            )}
            <Button type="submit" variant="secondary" disabled={isPasswordPending}>
              {isPasswordPending ? platform.settings.updating : platform.settings.updatePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
