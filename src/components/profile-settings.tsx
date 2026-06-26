"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CHECKOUT_LOCALES } from "@/lib/checkout-i18n";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { updateProfile, updatePassword } from "@/lib/actions/profile";
import {
  useLocalePreview,
  usePlatformCopy,
} from "@/components/locale-provider";
import { AccentColorPicker } from "@/components/accent-color-picker";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
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

function goalToFormValue(goal: string | null | undefined): string {
  return goal && goal.length > 0 ? goal : "";
}

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
  const setLocalePreview = useLocalePreview();
  const router = useRouter();

  const [name, setName] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [goalValue, setGoalValue] = useState(() => goalToFormValue(goal));
  const [locale, setLocale] = useState<CheckoutLocale>(preferredLocale);
  const [units, setUnits] = useState<"metric" | "imperial">(unitSystem);

  const serverSnapshot = useRef({
    fullName,
    phone: phone ?? "",
    goal: goalToFormValue(goal),
    preferredLocale,
    unitSystem,
  });

  useEffect(() => {
    const prev = serverSnapshot.current;
    const nextPhone = phone ?? "";
    const nextGoal = goalToFormValue(goal);

    if (
      prev.fullName !== fullName ||
      prev.phone !== nextPhone ||
      prev.goal !== nextGoal ||
      prev.preferredLocale !== preferredLocale ||
      prev.unitSystem !== unitSystem
    ) {
      serverSnapshot.current = {
        fullName,
        phone: nextPhone,
        goal: nextGoal,
        preferredLocale,
        unitSystem,
      };
      setName(fullName);
      setPhoneValue(nextPhone);
      setGoalValue(nextGoal);
      setLocale(preferredLocale);
      setUnits(unitSystem);
    }
  }, [fullName, phone, goal, preferredLocale, unitSystem]);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const handleLocaleChange = (next: CheckoutLocale) => {
    setLocale(next);
    setLocalePreview(next);
  };

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set("full_name", name);
    formData.set("phone", phoneValue);
    formData.set("goal", goalValue);
    formData.set("preferred_locale", locale);
    formData.set("unit_system", units);

    startProfileTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        setProfileError(result.error);
      } else {
        serverSnapshot.current = {
          fullName: name,
          phone: phoneValue,
          goal: goalValue,
          preferredLocale: locale,
          unitSystem: units,
        };
        setProfileSuccess(true);
        router.refresh();
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
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{platform.settings.fullName}</Label>
              <Input
                id="full_name"
                name="full_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="+383 44 123 456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">{platform.settings.fitnessGoal}</Label>
              <select
                id="goal"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
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
              <Label>{platform.settings.language}</Label>
              <input type="hidden" name="preferred_locale" value={locale} />
              <SegmentedToggle
                value={locale}
                onChange={handleLocaleChange}
                aria-label={platform.settings.language}
                options={CHECKOUT_LOCALES.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{platform.settings.units}</Label>
              <input type="hidden" name="unit_system" value={units} />
              <SegmentedToggle
                value={units}
                onChange={setUnits}
                aria-label={platform.settings.units}
                options={[
                  { value: "metric", label: platform.settings.metricToggle },
                  { value: "imperial", label: platform.settings.imperialToggle },
                ]}
              />
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
              <PasswordInput
                id="new_password"
                name="new_password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">{platform.settings.confirmPassword}</Label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
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
